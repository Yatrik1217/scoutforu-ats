#!/usr/bin/env python3
"""Render HANDOVER.md into a styled PDF (ScoutforU-Ops-Guide.pdf).

Usage:  python3 scripts/build_manual_pdf.py [output.pdf]
Needs only reportlab.  Handles headings, paragraphs, bullet/numbered lists,
tables, fenced code, inline **bold** / `code`.
"""
import os
import re
import sys

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    Preformatted, HRFlowable, KeepTogether,
)

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(REPO, "HANDOVER.md")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "ScoutforU-Ops-Guide.pdf")

INK = colors.HexColor("#16203a")
ACC = colors.HexColor("#2a6fdb")
MUT = colors.HexColor("#5a6573")
LIN = colors.HexColor("#e3e8f0")
SOFT = colors.HexColor("#f4f6fa")
CODEBG = colors.HexColor("#0f1628")
CODEFG = colors.HexColor("#e7edf7")

styles = {
    "h1": ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=20, leading=24,
                          textColor=INK, spaceBefore=6, spaceAfter=8),
    "h2": ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=14.5, leading=18,
                          textColor=colors.white, backColor=INK, borderPadding=(6, 8, 6, 8),
                          spaceBefore=16, spaceAfter=8, leftIndent=0),
    "h3": ParagraphStyle("h3", fontName="Helvetica-Bold", fontSize=12, leading=15,
                          textColor=ACC, spaceBefore=10, spaceAfter=4),
    "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9.3, leading=13.5,
                           textColor=INK, spaceAfter=6, alignment=TA_LEFT),
    "intro": ParagraphStyle("intro", fontName="Helvetica-Oblique", fontSize=9.5, leading=14,
                            textColor=MUT, spaceAfter=8),
    "bullet": ParagraphStyle("bullet", fontName="Helvetica", fontSize=9.3, leading=13.5,
                             textColor=INK, leftIndent=14, bulletIndent=3, spaceAfter=3),
    "cell": ParagraphStyle("cell", fontName="Helvetica", fontSize=8.4, leading=11.5, textColor=INK),
    "cellh": ParagraphStyle("cellh", fontName="Helvetica-Bold", fontSize=8.4, leading=11.5,
                            textColor=colors.white),
    "code": ParagraphStyle("code", fontName="Courier", fontSize=8, leading=11,
                           textColor=CODEFG, backColor=CODEBG, borderPadding=(8, 9, 8, 9),
                           spaceBefore=3, spaceAfter=8),
}


def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def inline(t):
    """Markdown inline -> reportlab mini-HTML."""
    t = esc(t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"`([^`]+?)`",
               r'<font face="Courier" size="8.2" color="#b1004a">\1</font>', t)
    return t


def build_flowables(md):
    flow = []
    lines = md.split("\n")
    i, n = 0, len(lines)
    while i < n:
        ln = lines[i]
        s = ln.strip()

        # fenced code
        if s.startswith("```"):
            i += 1
            buf = []
            while i < n and not lines[i].strip().startswith("```"):
                buf.append(lines[i])
                i += 1
            i += 1  # skip closing fence
            flow.append(Preformatted("\n".join(buf) or " ", styles["code"]))
            continue

        # table
        if s.startswith("|") and i + 1 < n and set(lines[i + 1].strip()) <= set("|-: "):
            rows = []
            header = [c.strip() for c in s.strip("|").split("|")]
            rows.append(header)
            i += 2  # skip header + separator
            while i < n and lines[i].strip().startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            flow.append(make_table(rows))
            flow.append(Spacer(1, 5))
            continue

        # headings
        if s.startswith("### "):
            flow.append(Paragraph(inline(s[4:]), styles["h3"])); i += 1; continue
        if s.startswith("## "):
            flow.append(Paragraph(inline(s[3:]), styles["h2"])); i += 1; continue
        if s.startswith("# "):
            flow.append(Paragraph(inline(s[2:]), styles["h1"])); i += 1; continue

        # horizontal rule
        if s == "---":
            flow.append(Spacer(1, 2))
            flow.append(HRFlowable(width="100%", thickness=0.6, color=LIN,
                                   spaceBefore=2, spaceAfter=6))
            i += 1
            continue

        # bullet list
        if s.startswith("- "):
            while i < n and lines[i].strip().startswith("- "):
                txt = lines[i].strip()[2:]
                # gather wrapped continuation lines (indented, not blank/new block)
                i += 1
                while i < n and lines[i].strip() and not re.match(
                        r"^(-\s|#|\||```|\d+\.\s|---)", lines[i].strip()) and lines[i].startswith("  "):
                    txt += " " + lines[i].strip()
                    i += 1
                flow.append(Paragraph(inline(txt), styles["bullet"], bulletText="•"))
            continue

        # numbered list
        if re.match(r"^\d+\.\s", s):
            while i < n and re.match(r"^\d+\.\s", lines[i].strip()):
                m = re.match(r"^(\d+)\.\s(.*)", lines[i].strip())
                num, txt = m.group(1), m.group(2)
                i += 1
                while i < n and lines[i].strip() and not re.match(
                        r"^(-\s|#|\||```|\d+\.\s|---)", lines[i].strip()) and lines[i].startswith("  "):
                    txt += " " + lines[i].strip()
                    i += 1
                flow.append(Paragraph(inline(txt), styles["bullet"], bulletText=num + "."))
            continue

        # blank
        if not s:
            i += 1
            continue

        # italic intro line _..._
        if s.startswith("_") and s.endswith("_") and len(s) > 2:
            flow.append(Paragraph(inline(s[1:-1]), styles["intro"])); i += 1; continue

        # paragraph (accumulate until blank / new block)
        para = [s]
        i += 1
        while i < n and lines[i].strip() and not re.match(
                r"^(-\s|#|\||```|\d+\.\s|---)", lines[i].strip()):
            para.append(lines[i].strip())
            i += 1
        text = " ".join(para)
        # whole-paragraph italic intro: _..._
        if text.startswith("_") and text.endswith("_") and len(text) > 2:
            flow.append(Paragraph(inline(text[1:-1]), styles["intro"]))
        else:
            flow.append(Paragraph(inline(text), styles["body"]))
    return flow


def make_table(rows):
    ncol = max(len(r) for r in rows)
    rows = [r + [""] * (ncol - len(r)) for r in rows]
    avail = A4[0] - 40 * mm
    if ncol == 2:
        widths = [avail * 0.28, avail * 0.72]
    else:
        widths = [avail / ncol] * ncol
    data = []
    for ri, r in enumerate(rows):
        st = styles["cellh"] if ri == 0 else styles["cell"]
        data.append([Paragraph(inline(c), st) for c in r])
    t = Table(data, colWidths=widths, repeatRows=1)
    ts = [
        ("BACKGROUND", (0, 0), (-1, 0), ACC),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, LIN),
        ("LINEAFTER", (0, 0), (-2, -1), 0.4, LIN),
        ("BOX", (0, 0), (-1, -1), 0.5, LIN),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]
    for ri in range(1, len(rows)):
        if ri % 2 == 0:
            ts.append(("BACKGROUND", (0, ri), (-1, ri), SOFT))
    t.setStyle(TableStyle(ts))
    return t


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LIN)
    canvas.setLineWidth(0.5)
    canvas.line(20 * mm, 12 * mm, A4[0] - 20 * mm, 12 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUT)
    canvas.drawString(20 * mm, 8 * mm, "ScoutforU — ATS + CRM Handover & Operations Guide")
    canvas.drawRightString(A4[0] - 20 * mm, 8 * mm, "Page %d" % doc.page)
    canvas.restoreState()


def main():
    with open(SRC, encoding="utf-8") as f:
        md = f.read()
    doc = BaseDocTemplate(
        OUT, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=18 * mm,
        title="ScoutforU Ops Guide", author="ScoutforU",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=footer)])
    doc.build(build_flowables(md))
    print("Wrote", OUT)


if __name__ == "__main__":
    main()
