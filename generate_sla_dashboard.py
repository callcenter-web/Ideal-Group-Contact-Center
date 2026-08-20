#!/usr/bin/env python3
"""
SLA Performance Dashboard Generator
Author: Senior Data Visualization Engineer & UI/UX Designer
Outputs: High-Resolution 300 DPI Print-Ready Landscape A4 PDF Dashboard
"""

import os
import sys
import io
import datetime
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.units import inch, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas

# ==============================================================================
# COLOR PALETTE & CONFIGURATION
# ==============================================================================
PRIMARY_NAVY = "#0F172A"
NAVY_ACCENT = "#1E293B"
SLATE_BORDER = "#CBD5E1"
BG_SOFT = "#F8FAFC"
WHITE = "#FFFFFF"

SUCCESS_GREEN = "#10B981"
SUCCESS_GREEN_BG = "#D1FAE5"
PENDING_ORANGE = "#F59E0B"
PENDING_ORANGE_BG = "#FEF3C7"
ESCALATED_ORANGE = "#EA580C"
ESCALATED_BG = "#FFEDD5"
CRITICAL_RED = "#EF4444"
CRITICAL_RED_BG = "#FEE2E2"
INFO_BLUE = "#3B82F6"
INFO_BLUE_BG = "#DBEAFE"
PURPLE_ACCENT = "#8B5CF6"

# ==============================================================================
# DATA STRUCTURES
# ==============================================================================
OVERALL_KPI = {
    "total": 75,
    "resolved": 42,
    "resolved_pct": 56,
    "pending": 30,
    "pending_pct": 40,
    "contacted": 3,
    "contacted_pct": 4,
    "csat_satisfied": 42,
    "csat_pct": 56,
    "dissatisfied": 8,
    "dissatisfied_pct": 11
}

AGING_DATA = [
    {"label": "0-3 Days (Immediate)", "count": 38, "pct": 51, "color": SUCCESS_GREEN, "bg": SUCCESS_GREEN_BG},
    {"label": "3-5 Days (Pending)", "count": 11, "pct": 15, "color": PENDING_ORANGE, "bg": PENDING_ORANGE_BG},
    {"label": "6-10 Days (Escalated)", "count": 3, "pct": 4, "color": ESCALATED_ORANGE, "bg": ESCALATED_BG},
    {"label": ">10 Days (Critical)", "count": 23, "pct": 31, "color": CRITICAL_RED, "bg": CRITICAL_RED_BG}
]

FEEDBACK_DATA = [
    {"category": "Satisfied After Resolution", "count": 42, "pct": 81, "color": SUCCESS_GREEN},
    {"category": "Customer Unreachable", "count": 5, "pct": 10, "color": PENDING_ORANGE},
    {"category": "Rejected Again to Service Station", "count": 3, "pct": 6, "color": ESCALATED_ORANGE},
    {"category": "No Solution Received", "count": 2, "pct": 3, "color": CRITICAL_RED},
    {"category": "Still Dissatisfied", "count": 0, "pct": 0, "color": "#94A3B8"}
]

STATIONS_TABLE_DATA = [
    # Station, Total, Resolved, Pending, Escalated, 0-3D, 3-5D, 6-10D, >10D, SC Contact %, CC Contact %, CC SLA %, Avg Stn Contact, Avg Solve Case
    ["Rathmalana (CWS)", "29", "13", "16", "0", "20", "-", "-", "9", "14/29 (48%)", "14/14 (100%)", "71%", "4d", "8d"],
    ["Wanawasala", "13", "11", "2", "0", "3", "-", "2", "8", "11/13 (85%)", "11/11 (100%)", "100%", "8d", "10d"],
    ["Yakkala", "8", "2", "6", "0", "6", "2", "-", "-", "3/8 (38%)", "3/3 (100%)", "100%", "2d", "4d"],
    ["Kurunegala", "3", "1", "2", "0", "2", "1", "-", "-", "2/3 (67%)", "2/2 (100%)", "100%", "9d", "5d"],
    ["Anuradhapura", "6", "5", "1", "0", "1", "5", "-", "-", "6/6 (100%)", "6/6 (100%)", "100%", "4d", "4d"],
    ["Jaffna", "10", "7", "3", "0", "3", "3", "1", "3", "10/10 (100%)", "10/10 (100%)", "90%", "6d", "7d"],
    ["Tissamaharama", "6", "3", "3", "0", "3", "-", "-", "3", "6/6 (100%)", "6/6 (100%)", "83%", "11d", "12d"],
]

SUMMARY_ROW = ["OVERALL SUMMARY", "75", "42", "33", "0", "38", "11", "3", "23", "52/75 (69%)", "52/52 (100%)", "88%", "6d", "8d"]


# ==============================================================================
# HIGH-RESOLUTION 300 DPI MATPLOTLIB CHART BUILDERS
# ==============================================================================
def create_aging_chart_buffer():
    """Builds horizontal bar progress chart for Aging SLA proportions at 300 DPI."""
    fig, ax = plt.subplots(figsize=(4.0, 3.1), dpi=300)
    fig.patch.set_facecolor(BG_SOFT)
    ax.set_facecolor(BG_SOFT)

    labels = [d["label"] for d in AGING_DATA][::-1]
    pcts = [d["pct"] for d in AGING_DATA][::-1]
    counts = [d["count"] for d in AGING_DATA][::-1]
    bar_colors = [d["color"] for d in AGING_DATA][::-1]

    y_pos = np.arange(len(labels))
    bars = ax.barh(y_pos, pcts, color=bar_colors, height=0.55, edgecolor="none", zorder=3)

    # Background gray tracks
    ax.barh(y_pos, [100]*len(labels), color="#E2E8F0", height=0.55, edgecolor="none", zorder=2)

    ax.set_xlim(0, 100)
    ax.set_yticks(y_pos)
    ax.set_yticklabels(labels, fontsize=7.5, fontweight='bold', color=PRIMARY_NAVY)
    ax.xaxis.set_visible(False)

    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.tick_params(left=False)

    # Data value labels inside/outside bars
    for bar, pct, count in zip(bars, pcts, counts):
        width = bar.get_width()
        text_x = width + 2 if width < 80 else width - 12
        text_color = PRIMARY_NAVY if width < 80 else WHITE
        ax.text(text_x, bar.get_y() + bar.get_height()/2, f"{pct}% ({count} cases)",
                va='center', ha='left' if width < 80 else 'right',
                fontsize=7.5, fontweight='black', color=text_color, zorder=4)

    plt.title("Aging SLA Proportions & Ticket Volume", fontsize=8.5, fontweight='black', color=PRIMARY_NAVY, pad=10, loc='left')
    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=300, facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
    plt.close(fig)
    buf.seek(0)
    return buf


def create_csat_donut_chart_buffer():
    """Builds crisp donut chart for CSAT & Feedback Breakdown at 300 DPI."""
    fig, ax = plt.subplots(figsize=(4.0, 3.1), dpi=300)
    fig.patch.set_facecolor(BG_SOFT)
    ax.set_facecolor(BG_SOFT)

    categories = [d["category"] for d in FEEDBACK_DATA if d["pct"] > 0]
    pcts = [d["pct"] for d in FEEDBACK_DATA if d["pct"] > 0]
    chart_colors = [d["color"] for d in FEEDBACK_DATA if d["pct"] > 0]

    wedges, texts, autotexts = ax.pie(
        pcts,
        labels=None,
        autopct='%1.0f%%',
        pctdistance=0.76,
        startangle=140,
        colors=chart_colors,
        wedgeprops=dict(width=0.42, edgecolor='white', linewidth=2.5)
    )

    for autotext in autotexts:
        autotext.set_fontsize(7.5)
        autotext.set_fontweight('black')
        autotext.set_color(WHITE)

    # Center circle annotation
    ax.text(0, 0.08, "81%", ha='center', va='center', fontsize=15, fontweight='black', color=SUCCESS_GREEN)
    ax.text(0, -0.15, "CSAT (SC Contacted)", ha='center', va='center', fontsize=6.0, fontweight='bold', color="#64748B")

    # Custom Clean Legend below
    legend_labels = [f"{c} ({p}%)" for c, p in zip(categories, pcts)]
    ax.legend(
        wedges, legend_labels,
        loc="lower center",
        bbox_to_anchor=(0.5, -0.22),
        ncol=2,
        frameon=False,
        fontsize=6.5,
        handlelength=1.0,
        handleheight=1.0
    )

    plt.title("Call Center Feedback (SC Contacted = YES)", fontsize=8.5, fontweight='black', color=PRIMARY_NAVY, pad=8, loc='left')
    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=300, facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
    plt.close(fig)
    buf.seek(0)
    return buf


def create_operational_speed_chart_buffer():
    """Builds operational speed metrics vs target benchmarks at 300 DPI."""
    fig, ax = plt.subplots(figsize=(4.0, 3.1), dpi=300)
    fig.patch.set_facecolor(BG_SOFT)
    ax.set_facecolor(BG_SOFT)

    metrics = [
        {"name": "Station Contact Speed", "actual": 6.0, "target": 2.0, "unit": "Days", "status": "Needs Attention", "color": PENDING_ORANGE},
        {"name": "Call Center Turnaround", "actual": 1.0, "target": 1.0, "unit": "Day", "status": "On Target (100%)", "color": SUCCESS_GREEN},
        {"name": "Full End-to-End Resolution", "actual": 8.0, "target": 7.0, "unit": "Days", "status": "Acceptable", "color": INFO_BLUE}
    ]

    y_pos = np.arange(len(metrics)) * 1.5
    bar_height = 0.45

    actuals = [m["actual"] for m in metrics]
    targets = [m["target"] for m in metrics]
    bar_colors = [m["color"] for m in metrics]

    # Background benchmark bar
    ax.barh(y_pos - 0.22, targets, height=bar_height*0.7, color="#CBD5E1", label="SLA Target Benchmark", edgecolor="none", zorder=2)
    # Actual performance bar
    bars = ax.barh(y_pos + 0.15, actuals, height=bar_height, color=bar_colors, label="Actual Average Speed", edgecolor="none", zorder=3)

    ax.set_yticks(y_pos)
    ax.set_yticklabels([m["name"] for m in metrics], fontsize=7.5, fontweight='bold', color=PRIMARY_NAVY)
    ax.set_xlim(0, 14)
    ax.set_xlabel("Days to Action / Resolve", fontsize=7, fontweight='bold', color="#64748B")

    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.grid(axis='x', linestyle='--', alpha=0.5, color='#CBD5E1')

    for bar, m in zip(bars, metrics):
        ax.text(bar.get_width() + 0.3, bar.get_y() + bar.get_height()/2,
                f"{m['actual']}d (Target: ≤{m['target']}d)",
                va='center', ha='left', fontsize=7, fontweight='black', color=PRIMARY_NAVY)

    ax.legend(loc='lower right', frameon=False, fontsize=6.5)
    plt.title("Operational Speed vs Target SLA Benchmarks", fontsize=8.5, fontweight='black', color=PRIMARY_NAVY, pad=8, loc='left')
    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=300, facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
    plt.close(fig)
    buf.seek(0)
    return buf


# ==============================================================================
# NUMBERED CANVAS WITH HEADER & FOOTER
# ==============================================================================
class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_decorations(self, page_count):
        self.saveState()
        # Top banner background bar
        self.setFillColor(colors.HexColor(PRIMARY_NAVY))
        self.rect(0, 8.27 * inch - 0.70 * inch, 11.69 * inch, 0.70 * inch, fill=1, stroke=0)

        # Header Title
        self.setFillColor(colors.white)
        self.setFont("Helvetica-Bold", 13)
        self.drawString(0.4 * inch, 8.27 * inch - 0.42 * inch, "IDEAL GROUP | CUSTOMER EXPERIENCE & SLA RECOVERY DASHBOARD")

        self.setFont("Helvetica", 8)
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        self.drawRightString(11.69 * inch - 0.4 * inch, 8.27 * inch - 0.42 * inch, f"Generated: {now_str} | Confidential & Proprietary")

        # Top banner sub-line
        self.setFillColor(colors.HexColor(SUCCESS_GREEN))
        self.rect(0, 8.27 * inch - 0.74 * inch, 11.69 * inch, 3, fill=1, stroke=0)

        # Bottom Footer
        self.setFillColor(colors.HexColor("#E2E8F0"))
        self.rect(0.4 * inch, 0.40 * inch, 11.69 * inch - 0.8 * inch, 1, fill=1, stroke=0)

        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(0.4 * inch, 0.25 * inch, "Ideal Aftermarket CX Performance Division • Contact: callcenter@idealgroup.lk • Single Source of Truth SLA Analytics")
        self.drawRightString(11.69 * inch - 0.4 * inch, 0.25 * inch, f"Page {self._pageNumber} of {page_count}")

        self.restoreState()


# ==============================================================================
# MAIN PDF BUILDER
# ==============================================================================
def build_pdf_dashboard(output_filename="SLA_Performance_Dashboard.pdf"):
    doc = SimpleDocTemplate(
        output_filename,
        pagesize=landscape(A4),
        leftMargin=0.4 * inch,
        rightMargin=0.4 * inch,
        topMargin=0.85 * inch,
        bottomMargin=0.50 * inch
    )

    styles = getSampleStyleSheet()
    
    # Custom Typography Styles
    style_section_title = ParagraphStyle(
        'SectionTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=12,
        textColor=colors.HexColor(PRIMARY_NAVY)
    )

    style_card_title = ParagraphStyle(
        'CardTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=9,
        textColor=colors.HexColor("#64748B"),
        alignment=TA_CENTER
    )

    style_card_num = ParagraphStyle(
        'CardNum',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=18,
        alignment=TA_CENTER
    )

    style_card_sub = ParagraphStyle(
        'CardSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=6.5,
        leading=8,
        textColor=colors.HexColor("#475569"),
        alignment=TA_CENTER
    )

    style_th = ParagraphStyle(
        'TH',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7,
        leading=8.5,
        textColor=colors.white,
        alignment=TA_CENTER
    )

    style_td = ParagraphStyle(
        'TD',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7,
        leading=8.5,
        textColor=colors.HexColor(PRIMARY_NAVY),
        alignment=TA_CENTER
    )

    style_td_station = ParagraphStyle(
        'TD_Station',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9,
        textColor=colors.HexColor(PRIMARY_NAVY),
        alignment=TA_LEFT
    )

    story = []

    # ==========================================================================
    # PAGE 1: EXECUTIVE GRAPHICAL DASHBOARD
    # ==========================================================================
    
    # Section Header & Executive Metadata
    summary_header_data = [
        [
            Paragraph("<b>EXECUTIVE SLA & COMPLAINT RECOVERY SUMMARY</b>", style_section_title),
            Paragraph(f"<b>Total Evaluated Tickets: 75</b> | Resolved: <b>42 (56%)</b> | Pending Recovery: <b>33 (44%)</b> | CSAT Rating: <font color='{SUCCESS_GREEN}'><b>56%</b></font>", ParagraphStyle('Sub', fontName='Helvetica', fontSize=8, textColor=colors.HexColor("#334155"), alignment=TA_RIGHT))
        ]
    ]
    t_sum_hdr = Table(summary_header_data, colWidths=[4.0 * inch, 6.89 * inch])
    t_sum_hdr.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(t_sum_hdr)
    story.append(Spacer(1, 4))

    # 4 Top KPI Cards Grid
    card_w = (11.69 * inch - 0.8 * inch - 0.3 * inch) / 4.0

    def make_kpi_cell(title, count, pct_str, subtitle, num_color, bg_hex, border_hex):
        p1 = Paragraph(title, style_card_title)
        p2 = Paragraph(f"<font color='{num_color}'><b>{count}</b></font> <font size='9' color='#64748B'>({pct_str})</font>", style_card_num)
        p3 = Paragraph(subtitle, style_card_sub)
        t = Table([[p1], [p2], [p3]], colWidths=[card_w - 6])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor(bg_hex)),
            ('BOX', (0,0), (-1,-1), 1.2, colors.HexColor(border_hex)),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('LEFTPADDING', (0,0), (-1,-1), 4),
            ('RIGHTPADDING', (0,0), (-1,-1), 4),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ]))
        return t

    c1 = make_kpi_cell("NEW (0-3 DAYS)", "38", "51%", "Immediate initial response speed", SUCCESS_GREEN, SUCCESS_GREEN_BG, SUCCESS_GREEN)
    c2 = make_kpi_cell("PENDING (3-5 DAYS)", "11", "15%", "Active customer follow-up in progress", PENDING_ORANGE, PENDING_ORANGE_BG, PENDING_ORANGE)
    c3 = make_kpi_cell("ESCALATED (6-10 DAYS)", "3", "4%", "Forwarded for regional manager review", ESCALATED_ORANGE, ESCALATED_BG, ESCALATED_ORANGE)
    c4 = make_kpi_cell("CRITICAL (>10 DAYS)", "23", "31%", "High-priority overdue aging tickets", CRITICAL_RED, CRITICAL_RED_BG, CRITICAL_RED)

    kpi_table = Table([[c1, c2, c3, c4]], colWidths=[card_w + 0.1 * inch]*4)
    kpi_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 2),
        ('RIGHTPADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 6))

    # 3 High-Resolution Chart Panels (300 DPI)
    chart1_buf = create_aging_chart_buffer()
    chart2_buf = create_csat_donut_chart_buffer()
    chart3_buf = create_operational_speed_chart_buffer()

    chart_w = 3.55 * inch
    chart_h = 3.25 * inch

    img1 = Image(chart1_buf, width=chart_w, height=chart_h)
    img2 = Image(chart2_buf, width=chart_w, height=chart_h)
    img3 = Image(chart3_buf, width=chart_w, height=chart_h)

    # Frame each chart in a clean rounded border card
    def wrap_chart_card(img_obj):
        t = Table([[img_obj]], colWidths=[chart_w + 4])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor(BG_SOFT)),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor(SLATE_BORDER)),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 4),
            ('RIGHTPADDING', (0,0), (-1,-1), 4),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ]))
        return t

    charts_grid = Table(
        [[wrap_chart_card(img1), wrap_chart_card(img2), wrap_chart_card(img3)]],
        colWidths=[chart_w + 0.1 * inch, chart_w + 0.1 * inch, chart_w + 0.1 * inch]
    )
    charts_grid.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 1),
        ('RIGHTPADDING', (0,0), (-1,-1), 1),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(charts_grid)

    # PAGE BREAK TO PAGE 2
    story.append(PageBreak())

    # ==========================================================================
    # PAGE 2: DETAILED SERVICE STATION PERFORMANCE BREAKDOWN MATRIX
    # ==========================================================================
    p2_header_data = [
        [
            Paragraph("<b>SERVICE STATION DETAILED PERFORMANCE DATA TABLE</b>", style_section_title),
            Paragraph("<b>Benchmark Criteria:</b> Station Contact ≤2d | CC Contact = 100% | CC SLA ≤24h target ≥80%", ParagraphStyle('Sub2', fontName='Helvetica-Oblique', fontSize=7.5, textColor=colors.HexColor("#475569"), alignment=TA_RIGHT))
        ]
    ]
    t_p2_hdr = Table(p2_header_data, colWidths=[4.5 * inch, 6.39 * inch])
    t_p2_hdr.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(t_p2_hdr)
    story.append(Spacer(1, 4))

    # Detailed Table Columns Definition
    # Total width = 10.89 inches
    col_widths = [
        1.55 * inch, # Service Station
        0.55 * inch, # Total
        0.55 * inch, # Resolved
        0.55 * inch, # Pending
        0.50 * inch, # Escalated
        0.50 * inch, # 0-3D
        0.50 * inch, # 3-5D
        0.50 * inch, # 6-10D
        0.50 * inch, # >10D
        1.25 * inch, # SC Contact %
        1.25 * inch, # CC Contact %
        0.85 * inch, # CC SLA %
        0.95 * inch, # Avg Stn Contact
        0.89 * inch, # Avg Solve Case
    ]

    table_headers = [
        Paragraph("<b>Service Station</b>", style_th),
        Paragraph("<b>Total</b>", style_th),
        Paragraph("<b>Resolved</b>", style_th),
        Paragraph("<b>Pending</b>", style_th),
        Paragraph("<b>Esc.</b>", style_th),
        Paragraph("<b>0-3D</b>", style_th),
        Paragraph("<b>3-5D</b>", style_th),
        Paragraph("<b>6-10D</b>", style_th),
        Paragraph("<b>>10D</b>", style_th),
        Paragraph("<b>SC Contact %</b>", style_th),
        Paragraph("<b>CC Contact %</b>", style_th),
        Paragraph("<b>CC SLA %</b>", style_th),
        Paragraph("<b>Avg Stn Cont.</b>", style_th),
        Paragraph("<b>Avg Solve</b>", style_th),
    ]

    matrix_rows = [table_headers]

    # Helper for styled chip percentage text
    def format_pct_chip(text_val, pct_val):
        if pct_val >= 80:
            return Paragraph(f"<font color='{SUCCESS_GREEN}'><b>{text_val}</b></font>", style_td)
        elif pct_val >= 50:
            return Paragraph(f"<font color='{PENDING_ORANGE}'><b>{text_val}</b></font>", style_td)
        else:
            return Paragraph(f"<font color='{CRITICAL_RED}'><b>{text_val}</b></font>", style_td)

    for row in STATIONS_TABLE_DATA:
        stn_name, tot, res, pnd, esc, d03, d35, d610, dgt10, sc_cont, cc_cont, cc_sla, avg_stn, avg_slv = row
        
        sc_pct = int(sc_cont.split("(")[1].replace("%)", "")) if "(" in sc_cont else 0
        cc_pct = int(cc_cont.split("(")[1].replace("%)", "")) if "(" in cc_cont else 0
        cc_sla_num = int(cc_sla.replace("%", ""))

        matrix_rows.append([
            Paragraph(f"<b>{stn_name}</b>", style_td_station),
            Paragraph(f"<b>{tot}</b>", style_td),
            Paragraph(f"<font color='{SUCCESS_GREEN}'><b>{res}</b></font>", style_td),
            Paragraph(f"<font color='{PENDING_ORANGE}'><b>{pnd}</b></font>", style_td),
            Paragraph(esc, style_td),
            Paragraph(d03 if d03 != "-" else "<font color='#94A3B8'>-</font>", style_td),
            Paragraph(d35 if d35 != "-" else "<font color='#94A3B8'>-</font>", style_td),
            Paragraph(d610 if d610 != "-" else "<font color='#94A3B8'>-</font>", style_td),
            Paragraph(dgt10 if dgt10 != "-" else "<font color='#94A3B8'>-</font>", style_td),
            format_pct_chip(sc_cont, sc_pct),
            format_pct_chip(cc_cont, cc_pct),
            format_pct_chip(cc_sla, cc_sla_num),
            Paragraph(f"<b>{avg_stn}</b>", style_td),
            Paragraph(f"<b>{avg_slv}</b>", style_td),
        ])

    # Summary Row
    summary_styled_row = [
        Paragraph(f"<b>{SUMMARY_ROW[0]}</b>", ParagraphStyle('SumStn', parent=style_td_station, textColor=colors.white)),
        Paragraph(f"<b>{SUMMARY_ROW[1]}</b>", ParagraphStyle('SumTd', parent=style_td, textColor=colors.white)),
        Paragraph(f"<b>{SUMMARY_ROW[2]}</b>", ParagraphStyle('SumTd', parent=style_td, textColor=colors.HexColor(SUCCESS_GREEN))),
        Paragraph(f"<b>{SUMMARY_ROW[3]}</b>", ParagraphStyle('SumTd', parent=style_td, textColor=colors.HexColor(PENDING_ORANGE))),
        Paragraph(f"<b>{SUMMARY_ROW[4]}</b>", ParagraphStyle('SumTd', parent=style_td, textColor=colors.white)),
        Paragraph(f"<b>{SUMMARY_ROW[5]}</b>", ParagraphStyle('SumTd', parent=style_td, textColor=colors.white)),
        Paragraph(f"<b>{SUMMARY_ROW[6]}</b>", ParagraphStyle('SumTd', parent=style_td, textColor=colors.white)),
        Paragraph(f"<b>{SUMMARY_ROW[7]}</b>", ParagraphStyle('SumTd', parent=style_td, textColor=colors.white)),
        Paragraph(f"<b>{SUMMARY_ROW[8]}</b>", ParagraphStyle('SumTd', parent=style_td, textColor=colors.white)),
        Paragraph(f"<b>{SUMMARY_ROW[9]}</b>", ParagraphStyle('SumTd', parent=style_td, textColor=colors.HexColor(PENDING_ORANGE))),
        Paragraph(f"<b>{SUMMARY_ROW[10]}</b>", ParagraphStyle('SumTd', parent=style_td, textColor=colors.HexColor(SUCCESS_GREEN))),
        Paragraph(f"<b>{SUMMARY_ROW[11]}</b>", ParagraphStyle('SumTd', parent=style_td, textColor=colors.HexColor(SUCCESS_GREEN))),
        Paragraph(f"<b>{SUMMARY_ROW[12]}</b>", ParagraphStyle('SumTd', parent=style_td, textColor=colors.white)),
        Paragraph(f"<b>{SUMMARY_ROW[13]}</b>", ParagraphStyle('SumTd', parent=style_td, textColor=colors.white)),
    ]
    matrix_rows.append(summary_styled_row)

    table_widget = Table(matrix_rows, colWidths=col_widths, repeatRows=1)
    
    table_style_list = [
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor(PRIMARY_NAVY)),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('RIGHTPADDING', (0,0), (-1,-1), 3),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor(SLATE_BORDER)),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor(PRIMARY_NAVY)), # Summary row dark navy
    ]

    # Alternating row background for clean visual rhythm
    for i in range(1, len(STATIONS_TABLE_DATA) + 1):
        bg_color = colors.HexColor(BG_SOFT) if i % 2 == 1 else colors.white
        table_style_list.append(('BACKGROUND', (0, i), (-1, i), bg_color))

    table_widget.setStyle(TableStyle(table_style_list))
    story.append(table_widget)
    story.append(Spacer(1, 8))

    # Analytical Insights & Key Highlights Callout Banner
    insights_html = (
        "<b>Executive Key Findings:</b><br/>"
        "• <b>Call Center Contact Rate:</b> 100% adherence (52/52 cases contacted once released by service centers) with <b>88%</b> achieving SLA &lt;24 hours.<br/>"
        "• <b>Service Station Response Speed:</b> Overall average is <b>6 days</b> against the target of ≤2 days. Rathmalana (48% contact rate) & Yakkala (38% contact rate) require immediate operational acceleration.<br/>"
        "• <b>CSAT Outcome:</b> 56% satisfied upon call center re-contact, with 35% requiring ongoing aftermarket technical solution."
    )
    p_insights = Paragraph(insights_html, ParagraphStyle('Insights', fontName='Helvetica', fontSize=7.5, leading=10, textColor=colors.HexColor(PRIMARY_NAVY)))
    
    t_insights = Table([[p_insights]], colWidths=[10.89 * inch])
    t_insights.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor(INFO_BLUE_BG)),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor(INFO_BLUE)),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_insights)

    # Build Document using custom Canvas
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"✅ Successfully compiled Print-Ready PDF Dashboard to: {output_filename}")


if __name__ == "__main__":
    output_pdf = "SLA_Performance_Dashboard.pdf"
    build_pdf_dashboard(output_pdf)
    
    # Also copy to public directory for instant browser download/viewing
    os.makedirs("public", exist_ok=True)
    import shutil
    shutil.copy(output_pdf, os.path.join("public", output_pdf))
    print(f"✅ Published downloadable asset to: public/{output_pdf}")
