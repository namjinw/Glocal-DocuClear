"""Generates the three sample PDFs used for manual upload checks.

Run with a Python that has reportlab and pillow:  python tests/fixtures/make_test_pdfs.py
Output goes to tests/fixtures/pdf/.
"""
import io
import os

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

FONT = 'C:/Windows/Fonts/malgun.ttf'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pdf')
W, H = A4
pdfmetrics.registerFont(TTFont('Malgun', FONT))

PAGE1 = [
    '프리랜서 용역 계약서',
    '',
    '제1조 (목적)',
    '본 계약은 갑이 을에게 영상 제작 업무를 위탁하고 을이 이를 수행하는 데 필요한 사항을 정한다.',
    '제2조 (계약기간)',
    '① 계약기간은 2025. 1. 1.부터 2025. 12. 31.까지로 한다.',
    '② 계약기간 만료 1개월 전까지 별도 의사표시가 없으면 같은 조건으로 1년씩 자동 갱신된다.',
    '제3조 (업무범위)',
    '① 을은 갑이 요청하는 영상 제작 업무를 수행한다.',
    '② 갑은 사업상 필요에 따라 제작 수량, 운영 채널 및 업무의 종류를 변경할 수 있다.',
    '③ 제2항에 따른 업무 증가는 별도 보수 청구의 사유가 되지 않는다.',
]
PAGE2 = [
    '제4조 (대금 지급)',
    '① 갑은 검수가 완료되고 세금계산서를 수령한 날부터 30일 이내에 월 5,000,000원을 지급한다.',
    '② 갑은 최종 고객으로부터 대금을 실제 수령한 후 지급할 수 있다.',
    '제5조 (손해배상)',
    '① 을의 손해배상 책임은 총 계약대금을 한도로 한다.',
    '② 다만 납기 지연, 업무 누락 및 그 밖의 계약상 의무 불이행에는 제1항의 한도를 적용하지 않는다.',
    '제6조 (보고)',
    '을은 매월 말일까지 월간 업무 보고서를 갑에게 제출한다.',
    '',
    '2025년 1월 1일',
    '갑: 주식회사 예시   (서명)        을: 홍길동   (서명)',
]
PAGE3 = [
    '제7조 (비밀유지)',
    '을은 계약 수행 중 알게 된 갑의 영업상 비밀을 제3자에게 누설하지 않는다.',
    '제8조 (분쟁 해결)',
    '본 계약과 관련한 분쟁은 갑의 본점 소재지를 관할하는 법원을 전속 관할로 한다.',
]


def wrap(text, width, measure):
    lines, current = [], ''
    for ch in text:
        if measure(current + ch) > width and current:
            lines.append(current)
            current = ch
        else:
            current += ch
    return lines + [current]


def text_page(c, lines):
    y = H - 70
    for line in lines:
        title = line.endswith('계약서')
        size = 16 if title else 11
        c.setFont('Malgun', size)
        for part in wrap(line, W - 120, lambda s: c.stringWidth(s, 'Malgun', size)) if line else ['']:
            c.drawString(60, y, part)
            y -= size + 8
        if line.startswith('제'):
            y += 0
    c.showPage()


def make_normal():
    c = canvas.Canvas(os.path.join(OUT, 'sample_01_normal_contract.pdf'), pagesize=A4)
    text_page(c, PAGE1)
    text_page(c, PAGE2)
    c.save()


def make_blank_page():
    c = canvas.Canvas(os.path.join(OUT, 'sample_02_normal_with_blank_page.pdf'), pagesize=A4)
    text_page(c, PAGE1)
    c.showPage()  # page 2 intentionally blank: expect a warning and exclusion
    text_page(c, PAGE2 + [''] + PAGE3)
    c.save()


def make_scanned():
    """Pages are raster images with no text layer, like a scan. Expect rejection with an OCR notice."""
    font = ImageFont.truetype(FONT, 26)
    c = canvas.Canvas(os.path.join(OUT, 'sample_03_error_scanned_image.pdf'), pagesize=A4)
    for lines in (PAGE1, PAGE2):
        img = Image.new('RGB', (1240, 1754), 'white')
        draw = ImageDraw.Draw(img)
        y = 120
        for line in lines:
            draw.text((100, y), line, fill='black', font=font)
            y += 48
        buf = io.BytesIO()
        img.save(buf, 'JPEG', quality=85)
        buf.seek(0)
        c.drawImage(ImageReader(buf), 0, 0, W, H)
        c.showPage()
    c.save()


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    make_normal()
    make_blank_page()
    make_scanned()
    print('created in', OUT)
