/**
 * Utility functions to convert OKLCH and modern CSS color functions to standard RGB/RGBA
 * to prevent html2canvas parsing errors like "Attempting to parse an unsupported color function 'oklch'".
 */

export function oklchToRgb(oklchStr: string): string {
  try {
    const match = oklchStr.match(/oklch\(([^)]+)\)/i);
    if (!match) return oklchStr;
    const content = match[1].trim();

    let parts: string[];
    let alphaStr = "1";

    if (content.includes("/")) {
      const [colorPart, aPart] = content.split("/");
      alphaStr = aPart.trim();
      parts = colorPart.trim().split(/[\s,]+/);
    } else {
      parts = content.trim().split(/[\s,]+/);
      if (parts.length >= 4) {
        alphaStr = parts[3];
        parts = parts.slice(0, 3);
      }
    }

    if (parts.length < 3) return "rgba(0, 0, 0, 1)";

    // Parse L (Lightness: 0..1 or 0%..100%)
    let lStr = parts[0].replace(/none/i, "0");
    let L = lStr.endsWith("%") ? parseFloat(lStr) / 100 : parseFloat(lStr);
    if (isNaN(L)) L = 0;

    // Parse C (Chroma)
    let cStr = parts[1].replace(/none/i, "0");
    let C = cStr.endsWith("%") ? parseFloat(cStr) / 100 : parseFloat(cStr);
    if (isNaN(C)) C = 0;

    // Parse H (Hue angle in degrees)
    let hStr = parts[2].replace(/none/i, "0");
    let H = parseFloat(hStr);
    if (isNaN(H)) H = 0;

    // Parse Alpha
    let alpha = 1;
    if (alphaStr) {
      let cleanedAlpha = alphaStr.replace(/none/i, "1");
      alpha = cleanedAlpha.endsWith("%") ? parseFloat(cleanedAlpha) / 100 : parseFloat(cleanedAlpha);
      if (isNaN(alpha)) alpha = 1;
    }

    // OKLCH -> OKLAB
    const hRad = (H * Math.PI) / 180;
    const a = C * Math.cos(hRad);
    const labB = C * Math.sin(hRad);

    // OKLAB -> linear sRGB
    const l_ = L + 0.3963377774 * a + 0.2158037573 * labB;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * labB;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * labB;

    const L3 = l_ * l_ * l_;
    const M3 = m_ * m_ * m_;
    const S3 = s_ * s_ * s_;

    const rLin = +4.0767416621 * L3 - 3.3077115913 * M3 + 0.2309699292 * S3;
    const gLin = -1.2684380046 * L3 + 2.6097574011 * M3 - 0.3413193965 * S3;
    const bLin = -0.0041960863 * L3 - 0.7034186147 * M3 + 1.7076147010 * S3;

    // Gamma correction to standard sRGB [0..255]
    const toGamma = (x: number) => {
      if (x <= 0) return 0;
      if (x >= 1) return 255;
      const gamma = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
      return Math.min(255, Math.max(0, Math.round(gamma * 255)));
    };

    const r = toGamma(rLin);
    const g = toGamma(gLin);
    const b = toGamma(bLin);

    if (alpha < 1) {
      return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
    }
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return "rgb(0, 0, 0)";
  }
}

export function replaceOklchInString(str: string): string {
  if (!str) return str;
  let result = str;
  if (result.includes("oklch(")) {
    result = result.replace(/oklch\([^)]+\)/gi, (match) => oklchToRgb(match));
  }
  if (result.includes("light-dark(")) {
    result = result.replace(/light-dark\(([^,]+),[^)]+\)/gi, "$1");
  }
  return result;
}

export function sanitizeDocOklch(clonedDoc: Document) {
  try {
    // 1. Sanitize all <style> tags content
    const styleTags = clonedDoc.querySelectorAll("style");
    styleTags.forEach((styleTag) => {
      if (styleTag.textContent && (styleTag.textContent.includes("oklch(") || styleTag.textContent.includes("light-dark("))) {
        styleTag.textContent = replaceOklchInString(styleTag.textContent);
      }
    });

    // 2. Sanitize inline styles & computed styles on elements
    const allElements = clonedDoc.querySelectorAll("*");
    allElements.forEach((el) => {
      const htmlEl = el as HTMLElement;

      const styleAttr = htmlEl.getAttribute("style");
      if (styleAttr && (styleAttr.includes("oklch(") || styleAttr.includes("light-dark("))) {
        htmlEl.setAttribute("style", replaceOklchInString(styleAttr));
      }

      // Check computed styles if defaultView is present
      try {
        const computed = clonedDoc.defaultView?.getComputedStyle(htmlEl);
        if (computed) {
          const props = ["color", "background-color", "border-color", "outline-color", "fill", "stroke"];
          props.forEach((prop) => {
            const val = computed.getPropertyValue(prop);
            if (val && (val.includes("oklch(") || val.includes("light-dark("))) {
              htmlEl.style.setProperty(prop, replaceOklchInString(val), "important");
            }
          });
        }
      } catch {
        // ignore computed style read errors
      }
    });
  } catch (err) {
    console.warn("sanitizeDocOklch warning:", err);
  }
}
