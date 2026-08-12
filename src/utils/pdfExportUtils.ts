/**
 * Utility functions to convert OKLCH, OKLAB, LAB, LCH, color-mix, and modern CSS color functions to standard RGB/RGBA/Hex
 * to prevent html2canvas parsing errors like "Attempting to parse an unsupported color function 'oklab'"
 * or "Attempting to parse an unsupported color function 'oklch'".
 */

const colorCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
const colorCtx = colorCanvas ? colorCanvas.getContext("2d") : null;

/**
 * Uses browser's native 2D Canvas context to parse any CSS color string (oklch, oklab, color-mix, light-dark, etc.)
 * directly into standard #rrggbb or rgba(...) format.
 */
export function parseCssColorToRgb(colorStr: string): string {
  if (!colorStr || !colorCtx) return colorStr;
  try {
    colorCtx.fillStyle = "#000000"; // reset
    colorCtx.fillStyle = colorStr;
    const resolved = colorCtx.fillStyle;
    if (
      resolved &&
      !resolved.includes("oklch") &&
      !resolved.includes("oklab") &&
      !resolved.includes("color-mix") &&
      !resolved.includes("light-dark") &&
      !resolved.includes("lab(") &&
      !resolved.includes("lch(")
    ) {
      return resolved;
    }
    return colorStr;
  } catch {
    return colorStr;
  }
}

export function oklchToRgb(oklchStr: string): string {
  try {
    const match = oklchStr.match(/oklch\(([^)]+)\)/i);
    if (!match) return "rgb(0, 0, 0)";
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

    if (parts.length < 3) return "rgb(0, 0, 0)";

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

export function oklabToRgb(oklabStr: string): string {
  try {
    const match = oklabStr.match(/oklab\(([^)]+)\)/i);
    if (!match) return "rgb(0, 0, 0)";
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

    if (parts.length < 3) return "rgb(0, 0, 0)";

    // Parse L (Lightness: 0..1 or 0%..100%)
    let lStr = parts[0].replace(/none/i, "0");
    let L = lStr.endsWith("%") ? parseFloat(lStr) / 100 : parseFloat(lStr);
    if (isNaN(L)) L = 0;

    // Parse a
    let aStr = parts[1].replace(/none/i, "0");
    let a = aStr.endsWith("%") ? parseFloat(aStr) / 100 : parseFloat(aStr);
    if (isNaN(a)) a = 0;

    // Parse b
    let bStr = parts[2].replace(/none/i, "0");
    let labB = bStr.endsWith("%") ? parseFloat(bStr) / 100 : parseFloat(bStr);
    if (isNaN(labB)) labB = 0;

    // Parse Alpha
    let alpha = 1;
    if (alphaStr) {
      let cleanedAlpha = alphaStr.replace(/none/i, "1");
      alpha = cleanedAlpha.endsWith("%") ? parseFloat(cleanedAlpha) / 100 : parseFloat(cleanedAlpha);
      if (isNaN(alpha)) alpha = 1;
    }

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

export function labToRgb(labStr: string): string {
  try {
    const match = labStr.match(/lab\(([^)]+)\)/i);
    if (!match) return "rgb(0, 0, 0)";
    const content = match[1].trim();
    let parts = content.split(/[\s,/]+/);
    if (parts.length < 3) return "rgb(0, 0, 0)";
    let L = parseFloat(parts[0]);
    let a = parseFloat(parts[1]);
    let b = parseFloat(parts[2]);
    if (isNaN(L)) L = 0;
    if (isNaN(a)) a = 0;
    if (isNaN(b)) b = 0;

    let y = (L + 16) / 116;
    let x = a / 500 + y;
    let z = y - b / 200;

    const x3 = Math.pow(x, 3);
    const y3 = Math.pow(y, 3);
    const z3 = Math.pow(z, 3);

    const xr = x3 > 0.008856 ? x3 : (x - 16 / 116) / 7.787;
    const yr = y3 > 0.008856 ? y3 : (y - 16 / 116) / 7.787;
    const zr = z3 > 0.008856 ? z3 : (z - 16 / 116) / 7.787;

    const X = xr * 0.95047;
    const Y = yr * 1.0;
    const Z = zr * 1.08883;

    let rLin = X * 3.2406 + Y * -1.5372 + Z * -0.4986;
    let gLin = X * -0.9689 + Y * 1.8758 + Z * 0.0415;
    let bLin = X * 0.0557 + Y * -0.2040 + Z * 1.057;

    const toGamma = (v: number) => {
      if (v <= 0) return 0;
      if (v >= 1) return 255;
      const g = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
      return Math.min(255, Math.max(0, Math.round(g * 255)));
    };

    return `rgb(${toGamma(rLin)}, ${toGamma(gLin)}, ${toGamma(bLin)})`;
  } catch {
    return "rgb(0, 0, 0)";
  }
}

export function colorSrgbToRgb(colorStr: string): string {
  try {
    const parsed = parseCssColorToRgb(colorStr);
    if (parsed && !parsed.includes("color(")) return parsed;
    return "rgb(0, 0, 0)";
  } catch {
    return "rgb(0, 0, 0)";
  }
}

export function colorMixToRgb(colorMixStr: string): string {
  try {
    const parsed = parseCssColorToRgb(colorMixStr);
    if (
      parsed &&
      !parsed.includes("color-mix") &&
      !parsed.includes("oklab") &&
      !parsed.includes("oklch")
    ) {
      return parsed;
    }
    const rgbMatch = colorMixStr.match(/(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})/);
    if (rgbMatch && rgbMatch[1]) {
      return rgbMatch[1];
    }
    return "rgb(15, 23, 42)";
  } catch {
    return "rgb(15, 23, 42)";
  }
}

/**
 * Replaces a CSS function call like `color-mix(...)` or `oklab(...)` by scanning for balanced parentheses.
 */
function replaceFuncWithBalancedParens(
  str: string,
  funcName: string,
  replacer: (fullMatch: string) => string
): string {
  let lowerStr = str.toLowerCase();
  let searchIdx = 0;

  while (true) {
    const startIdx = lowerStr.indexOf(funcName + "(", searchIdx);
    if (startIdx === -1) break;

    let openParens = 0;
    let endIdx = -1;
    for (let i = startIdx + funcName.length; i < str.length; i++) {
      if (str[i] === "(") openParens++;
      else if (str[i] === ")") {
        openParens--;
        if (openParens === 0) {
          endIdx = i;
          break;
        }
      }
    }

    if (endIdx !== -1) {
      const fullMatch = str.slice(startIdx, endIdx + 1);
      const replacement = replacer(fullMatch);
      str = str.slice(0, startIdx) + replacement + str.slice(endIdx + 1);
      lowerStr = str.toLowerCase();
      searchIdx = startIdx + replacement.length;
    } else {
      searchIdx = startIdx + funcName.length + 1;
    }
  }

  return str;
}

export function scrubUnsupportedColorKeywords(str: string): string {
  if (!str) return str;
  return str
    .replace(/in\s+oklab/gi, "in srgb")
    .replace(/in\s+oklch/gi, "in srgb")
    .replace(/oklab\([^)]*\)/gi, "rgb(15, 23, 42)")
    .replace(/oklch\([^)]*\)/gi, "rgb(15, 23, 42)")
    .replace(/color-mix\([^)]*\)/gi, "rgb(15, 23, 42)")
    .replace(/light-dark\([^)]*\)/gi, "rgb(15, 23, 42)")
    .replace(/lab\([^)]*\)/gi, "rgb(15, 23, 42)")
    .replace(/lch\([^)]*\)/gi, "rgb(15, 23, 42)");
}

export function replaceModernColorsInString(str: string): string {
  if (!str) return str;
  let result = str;

  // 1. Replace light-dark(...)
  result = replaceFuncWithBalancedParens(result, "light-dark", (match) => {
    // Extract first parameter before comma
    const inner = match.slice("light-dark(".length, -1).trim();
    const commaIdx = inner.indexOf(",");
    if (commaIdx !== -1) {
      return inner.slice(0, commaIdx).trim();
    }
    return inner;
  });

  // 2. Replace color-mix(...)
  result = replaceFuncWithBalancedParens(result, "color-mix", (match) => {
    return colorMixToRgb(match);
  });

  // 3. Replace oklab(...)
  result = replaceFuncWithBalancedParens(result, "oklab", (match) => {
    const parsed = parseCssColorToRgb(match);
    return parsed !== match && !parsed.includes("oklab") ? parsed : oklabToRgb(match);
  });

  // 4. Replace oklch(...)
  result = replaceFuncWithBalancedParens(result, "oklch", (match) => {
    const parsed = parseCssColorToRgb(match);
    return parsed !== match && !parsed.includes("oklch") ? parsed : oklchToRgb(match);
  });

  // 5. Replace lab(...)
  result = replaceFuncWithBalancedParens(result, "lab", (match) => {
    const parsed = parseCssColorToRgb(match);
    return parsed !== match && !parsed.includes("lab") ? parsed : labToRgb(match);
  });

  // 6. Replace lch(...)
  result = replaceFuncWithBalancedParens(result, "lch", (match) => {
    const parsed = parseCssColorToRgb(match);
    return parsed !== match && !parsed.includes("lch") ? parsed : oklchToRgb(match);
  });

  // 7. Replace color(...)
  result = replaceFuncWithBalancedParens(result, "color", (match) => {
    const parsed = parseCssColorToRgb(match);
    return parsed !== match && !parsed.includes("color(") ? parsed : colorSrgbToRgb(match);
  });

  // 8. Scrub any leftover strings
  return scrubUnsupportedColorKeywords(result);
}

export function sanitizeDocOklch(clonedDoc: Document) {
  try {
    // 1. Convert/Sanitize <link rel="stylesheet"> tags into <style> tags
    const linkTags = Array.from(clonedDoc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
    linkTags.forEach((link) => {
      let combinedCss = "";
      try {
        // Find matching sheet in document.styleSheets
        for (let i = 0; i < document.styleSheets.length; i++) {
          const sheet = document.styleSheets[i];
          if (sheet.href === link.href || sheet.ownerNode === link) {
            try {
              const rules = sheet.cssRules || sheet.rules;
              if (rules) {
                for (let j = 0; j < rules.length; j++) {
                  combinedCss += rules[j].cssText + "\n";
                }
              }
            } catch {
              // cross-origin rule access blocked
            }
          }
        }
      } catch {
        // ignore stylesheet read errors
      }

      if (combinedCss) {
        const sanitizedCss = replaceModernColorsInString(combinedCss);
        const styleTag = clonedDoc.createElement("style");
        styleTag.textContent = sanitizedCss;
        link.parentNode?.replaceChild(styleTag, link);
      } else {
        // Remove external link if we cannot read or sanitize its CSS to prevent html2canvas parsing errors
        link.parentNode?.removeChild(link);
      }
    });

    // 2. Sanitize all <style> tags content
    const styleTags = clonedDoc.querySelectorAll("style");
    styleTags.forEach((styleTag) => {
      if (styleTag.textContent) {
        styleTag.textContent = replaceModernColorsInString(styleTag.textContent);
      }
    });

    // 3. Sanitize inline styles & computed styles on elements
    const allElements = clonedDoc.querySelectorAll<HTMLElement>("*");
    allElements.forEach((htmlEl) => {
      const styleAttr = htmlEl.getAttribute("style");
      if (styleAttr) {
        htmlEl.setAttribute("style", replaceModernColorsInString(styleAttr));
      }

      try {
        const computed = clonedDoc.defaultView?.getComputedStyle(htmlEl) || window.getComputedStyle(htmlEl);
        if (computed) {
          const props = [
            "color",
            "background-color",
            "border-color",
            "border-top-color",
            "border-bottom-color",
            "border-left-color",
            "border-right-color",
            "outline-color",
            "fill",
            "stroke",
            "box-shadow",
            "text-decoration-color",
            "caret-color"
          ];
          props.forEach((prop) => {
            const val = computed.getPropertyValue(prop);
            if (
              val &&
              (val.includes("oklch") ||
               val.includes("oklab") ||
               val.includes("color-mix") ||
               val.includes("color(") ||
               val.includes("light-dark") ||
               val.includes("lab(") ||
               val.includes("lch("))
            ) {
              const sanitizedVal = replaceModernColorsInString(val);
              htmlEl.style.setProperty(prop, sanitizedVal, "important");
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
