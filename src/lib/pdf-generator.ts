import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Exam, Variant, Question, Student } from '../types';

/**
 * Strips HTML tags for PDF rendering
 */
const stripHtml = (html: string) => {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
};

const imageCache = new Map<string, string>();

/**
 * Converts image URL to Data URL for jsPDF with caching
 */
const getAsDataURL = (url: string): Promise<string> => {
    if (imageCache.has(url)) return Promise.resolve(imageCache.get(url)!);

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            imageCache.set(url, dataUrl);
            resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = url;
    });
};

/**
 * Opens PDF in a new browser tab for preview (with fallback for blocked popups)
 */
const previewPdf = (doc: jsPDF, filename: string = 'hujjat.pdf') => {
    try {
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        const newWindow = window.open(url, '_blank');
        
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
            // Popup blocked - fall back to download
            doc.save(filename);
            console.log("Popup blocked, downloading instead.");
        }

        // Revoke after a delay to ensure it loads
        setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) {
        console.error("PDF Preview Error:", err);
        doc.save(filename);
    }
};

/**
 * Generates a PDF Question Paper for a specific variant with a two-column layout
 */
export async function generateQuestionPaper(exam: Exam, variant: Variant, allQuestions: Question[]) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const colGap = 10;
    const colWidth = (pageWidth - (2 * margin) - colGap) / 2;
    const columnXs = [margin, margin + colWidth + colGap];
    
    let currentCol = 0;
    let y = 65; // Starting Y after header
    const startY = 65;
    const yLimit = pageHeight - 15;

    // Header (Full width)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(exam.name.toUpperCase(), pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const headerInfo = `${exam.date} | ${exam.duration} daqiqa | Jami: ${exam.totalQuestions} ta savol`;
    doc.text(headerInfo, pageWidth / 2, 30, { align: 'center' });

    // Variant QR Code
    const qrData = JSON.stringify({ e: exam.id, v: variant.variantCode });
    const qrUrl = await QRCode.toDataURL(qrData, { margin: 1, scale: 2 });
    doc.addImage(qrUrl, 'PNG', pageWidth - 40, 10, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text(`VARIANT: ${variant.variantCode}`, pageWidth - 40, 45);

    doc.setDrawColor(200);
    doc.line(margin, 55, pageWidth - margin, 55);

    // Function to draw vertical separator
    const drawSeparator = (pageDoc: jsPDF) => {
        pageDoc.setDrawColor(230);
        pageDoc.setLineWidth(0.1);
        pageDoc.line(pageWidth / 2, startY - 5, pageWidth / 2, yLimit);
    };

    drawSeparator(doc);

    // Questions
    doc.setFontSize(10);
    for (const vq of variant.questions) {
        const originalQ = allQuestions.find(q => q.id === vq.questionId);
        if (!originalQ) continue;

        const text = `${vq.order}. ${stripHtml(originalQ.text)}`;
        const lines = doc.splitTextToSize(text, colWidth);
        const textHeight = lines.length * 5;
        const imageHeight = originalQ.imageUrl ? 45 : 0;
        const totalHeight = textHeight + imageHeight + 25; // 25 for options and spacing

        // Check if question fits in current column
        if (y + totalHeight > yLimit) {
            if (currentCol === 0) {
                currentCol = 1;
                y = startY;
            } else {
                doc.addPage();
                drawSeparator(doc);
                currentCol = 0;
                y = startY;
            }
        }

        const x = columnXs[currentCol];

        doc.setFont('helvetica', 'bold');
        doc.text(lines, x, y);
        y += textHeight + 2;

        // Image in column
        if (originalQ.imageUrl) {
            try {
                const imgData = await getAsDataURL(originalQ.imageUrl);
                // Maintain aspect ratio or fit to colWidth
                doc.addImage(imgData, 'PNG', x + 2, y, colWidth - 4, 40);
                y += 42;
            } catch (e) {
                doc.setFontSize(7);
                doc.setTextColor(200);
                doc.text("[Rasm yuklanmadi]", x + 5, y + 5);
                y += 8;
                doc.setTextColor(0);
                doc.setFontSize(10);
            }
        }

        // Options
        doc.setFont('helvetica', 'normal');
        ['A', 'B', 'C', 'D'].forEach(opt => {
            const optText = `${opt}) ${vq.shuffledOptions[opt as keyof typeof vq.shuffledOptions]}`;
            doc.text(optText, x + 5, y);
            y += 5;
        });

        y += 6; // Spacing between questions
    }

    previewPdf(doc, `savollar-${exam.name}-${variant.variantCode}.pdf`);
}

/**
 * Pre-prepared data for rendering OMR page to speed up generateBulkOMRSheets
 */
interface OMRData {
    qrUrl: string;
    photoData?: string;
}

/**
 * Core rendering logic for the professional OMR Answer Sheet
 */
const renderOMRPage = async (doc: jsPDF, exam: Exam, student?: Student, variantCode?: string, preparedData?: OMRData) => {
    const pageWidth = 210;
    const pageHeight = 297;
    const mainColor = [0, 100, 100]; // Teal/Cyan accent
    
    // 1. Timing Marks
    doc.setFillColor("#000000");
    const markSize = 4.5;
    doc.rect(5, 5, markSize, markSize, 'F');
    doc.rect(pageWidth - 9.5, 5, markSize, markSize, 'F');
    doc.rect(5, pageHeight - 9.5, markSize, markSize, 'F');
    doc.rect(pageWidth - 9.5, pageHeight - 9.5, markSize, markSize, 'F');

    // 2. Top Barcode
    const drawBarcode = (x: number, y: number, w: number, h: number) => {
        doc.setFillColor("#000000");
        let currentX = x;
        while (currentX < x + w) {
            const barW = Math.random() * 1.5 + 0.5;
            const gapW = Math.random() * 1.0 + 0.3;
            if (currentX + barW > x + w) break;
            doc.rect(currentX, y, barW, h, 'F');
            currentX += barW + gapW;
        }
    };
    drawBarcode(60, 8, 90, 5);

    // 3. Header Section
    try {
        const logoData = await getAsDataURL('/logo.png');
        doc.addImage(logoData, 'PNG', 15, 10, 12, 12);
    } catch (e) {
        doc.setDrawColor(0);
        doc.circle(21, 16, 6);
    }
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text("SARIOSIYO", 28, 14);
    doc.setFontSize(5);
    doc.setFont('helvetica', 'normal');
    doc.text("O'QUV MARKAZI", 28, 17);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text("JAVOBLAR VARAQASI", pageWidth / 2 + 10, 18, { align: 'center' });
    
    doc.setDrawColor(200);
    doc.line(15, 26, pageWidth - 15, 26);

    // 4. Instructions Block
    const instrX = 15;
    const instrY = 32;
    const instrW = 85;
    const instrH = 55;

    doc.setDrawColor(mainColor[0], mainColor[1], mainColor[2]);
    doc.setLineWidth(0.4);
    doc.rect(instrX, instrY, instrW, instrH);
    
    doc.setFillColor(mainColor[0], mainColor[1], mainColor[2]);
    doc.rect(instrX, instrY, instrW, 5, 'F');
    doc.setTextColor(255);
    doc.setFontSize(8);
    doc.text("ESLATMA", instrX + instrW/2, instrY + 3.8, { align: 'center' });

    doc.setTextColor(0);
    doc.setFontSize(7);
    const instructions = [
        "ABITURIYENT DIQQATIGA!",
        "1. HAR BIR TEST TOPSHIRIG'IGA FAQAT BITTA JAVOB BELGILANG.",
        "2. DOIRACHANI TO'LIQ VA QORA RUCHKADA BO'YANG."
    ];
    let ty = instrY + 10;
    instructions.forEach(line => {
        doc.text(line, instrX + 5, ty);
        ty += 5;
    });

    doc.setFontSize(6);
    doc.text("To'g'ri / Правильно", instrX + 10, instrY + 45);
    doc.text("Noto'g'ri / Неправильно", instrX + 45, instrY + 45);
    
    doc.setDrawColor(0);
    doc.circle(instrX + 13, instrY + 50, 1.8);
    doc.setFillColor("#000000");
    doc.circle(instrX + 13, instrY + 50, 1.5, 'F');
    
    [32, 42, 52, 62].forEach((offset, idx) => {
        const bx = instrX + idx * 10 + 35;
        const by = instrY + 50;
        doc.setDrawColor(150);
        doc.circle(bx, by, 1.8);
        doc.setDrawColor(0);
        if (idx === 0) { doc.line(bx-1, by-1, bx+1, by+1); doc.line(bx+1, by-1, bx-1, by+1); }
        else if (idx === 1) { doc.line(bx-1, by, bx, by+1); doc.line(bx, by+1, bx+1.5, by-1); }
        else if (idx === 2) { doc.circle(bx, by, 0.5, 'F'); }
    });

    // 5. Student Info Block
    const infoX = instrX + instrW + 5;
    const infoY = instrY;
    const infoW = 90;
    const infoH = instrH;

    doc.setDrawColor(mainColor[0], mainColor[1], mainColor[2]);
    doc.rect(infoX, infoY, infoW, infoH);
    doc.setFillColor(mainColor[0], mainColor[1], mainColor[2]);
    doc.rect(infoX, infoY, infoW, 5, 'F');
    doc.setTextColor(255);
    doc.text("ABITURIYENT INFO", infoX + infoW/2, infoY + 3.8, { align: 'center' });

    doc.setTextColor(0);
    doc.setFontSize(7);
    doc.text("F.I.SH:", infoX + 5, infoY + 10);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(student?.name.toUpperCase() || "_________________________", infoX + 5, infoY + 15);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text("Muassasa:", infoX + 5, infoY + 22);
    doc.text("Sariosiyo o'quv markazi", infoX + 5, infoY + 26);
    
    doc.text("Abituriyent ID'si:", infoX + 50, infoY + 22);
    doc.setFontSize(10);
    doc.text(student?.id.toString() || "________", infoX + 50, infoY + 28);

    // QR Code
    try {
        const qrUrl = preparedData?.qrUrl || await QRCode.toDataURL(JSON.stringify({ e: exam.id, s: student?.id || 0, v: variantCode || '' }), { margin: 1 });
        doc.addImage(qrUrl, 'PNG', infoX + 5, infoY + 30, 22, 22);
    } catch (e) {
        console.error("QR Code failed", e);
    }
    
    // Photo
    const photoUrl = student?.photo;
    if (photoUrl || preparedData?.photoData) {
        try {
            const photoData = preparedData?.photoData || await getAsDataURL(photoUrl!);
            doc.addImage(photoData, 'PNG', infoX + 65, infoY + 30, 20, 22);
        } catch (e) {
            doc.setDrawColor(200);
            doc.rect(infoX + 65, infoY + 30, 20, 22);
            doc.setFontSize(5);
            doc.text("PHOTO", infoX + 75, infoY + 41, { align: 'center' });
        }
    } else {
        doc.setDrawColor(200);
        doc.rect(infoX + 65, infoY + 30, 20, 22);
        doc.setFontSize(5);
        doc.text("PHOTO", infoX + 75, infoY + 41, { align: 'center' });
    }

    // 6. Identifying Grids
    const gridY = instrY + instrH + 10;
    const idGridX = 115;
    doc.setFillColor(mainColor[0], mainColor[1], mainColor[2]);
    doc.rect(idGridX, gridY - 5, 45, 5, 'F');
    doc.setTextColor(255);
    doc.setFontSize(8);
    doc.text("ABITURIYENT ID", idGridX + 22.5, gridY - 1.5, { align: 'center' });
    
    const drawBubbleColumn = (bx: number, by: number, count: number) => {
        for (let i = 0; i < count; i++) {
            const vy = by + (i * 5.2);
            doc.setDrawColor(mainColor[0], mainColor[1], mainColor[2]);
            doc.circle(bx, vy, 1.6);
            doc.setFontSize(5);
            doc.setTextColor(mainColor[0], mainColor[1], mainColor[2]);
            doc.text(i.toString(), bx - 0.6, vy + 0.4);
        }
    };

    for (let c = 0; c < 8; c++) drawBubbleColumn(idGridX + 3 + (c * 5.4), gridY + 4, 10);
    doc.setDrawColor(mainColor[0], mainColor[1], mainColor[2]);
    doc.rect(idGridX, gridY, 45, 55);

    const varGridX = 165;
    doc.rect(varGridX, gridY - 5, 30, 5, 'F');
    doc.text("Variant", varGridX + 15, gridY - 1.5, { align: 'center' });
    for (let c = 0; c < 4; c++) drawBubbleColumn(varGridX + 5 + (c * 6.5), gridY + 4, 5);
    doc.rect(varGridX, gridY, 30, 30);

    // 7. Answer Section
    const ansY = gridY;
    const ansX = 15;
    const ansW = 90;
    doc.setFillColor(mainColor[0], mainColor[1], mainColor[2]);
    doc.rect(ansX, ansY - 5, ansW, 5, 'F');
    doc.setTextColor(255);
    doc.text("MATEMATIKA", ansX + ansW/2, ansY - 1.5, { align: 'center' });
    doc.setDrawColor(mainColor[0], mainColor[1], mainColor[2]);
    doc.rect(ansX, ansY, ansW, 105);

    for (let i = 0; i < 30; i++) {
        const col = Math.floor(i / 15);
        const row = i % 15;
        const x = ansX + 5 + (col * 42);
        const y = ansY + 5 + (row * 6.5);
        doc.setFontSize(7);
        doc.setTextColor(mainColor[0], mainColor[1], mainColor[2]);
        doc.text(`${(i + 1).toString().padStart(2, '0')}`, x, y + 1);
        ['A', 'B', 'C', 'D'].forEach((label, idx) => {
            const bx = x + 10 + (idx * 6);
            doc.setDrawColor(mainColor[0], mainColor[1], mainColor[2]);
            doc.circle(bx, y, 1.7);
            doc.setFontSize(5);
            doc.text(label, bx - 0.7, y + 0.4);
        });
    }

    // 8. Footer
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text("Sariosiyo o'quv markazi uchun maxsus javoblar varaqasi", pageWidth / 2, pageHeight - 12, { align: 'center' });
};

/**
 * Generates a single OMR Answer Sheet
 */
export async function generateOMRSheet(exam: Exam, student?: Student, variant?: Variant) {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    await renderOMRPage(doc, exam, student, variant?.variantCode);
    previewPdf(doc, `omr-${student?.name || 'shablon'}.pdf`);
}

/**
 * Generates bulk OMR sheets with optimized data preparation
 */
export async function generateBulkOMRSheets(exam: Exam, students: Student[]) {
    try {
        console.log(`Starting bulk generation for ${students.length} students...`);
        
        // 1. Pre-fetch common assets and student data in parallel
        const prepPromises = students.map(async (student, index) => {
            const variantCode = exam.variants ? exam.variants[index % exam.variants.length].variantCode : '';
            const qrUrl = await QRCode.toDataURL(JSON.stringify({ 
                e: exam.id, 
                s: student.id, 
                v: variantCode 
            }), { margin: 1 });
            
            let photoData;
            if (student.photo) {
                try {
                    photoData = await getAsDataURL(student.photo);
                } catch (e) {
                    console.warn(`Could not load photo for student ${student.id}`);
                }
            }
            
            return { student, variantCode, qrUrl, photoData };
        });
        
        const preparedList = await Promise.all(prepPromises);
        console.log("Data preparation complete. Rendering PDF...");

        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        
        for (let i = 0; i < preparedList.length; i++) {
            const { student, variantCode, qrUrl, photoData } = preparedList[i];
            if (i !== 0) doc.addPage();
            await renderOMRPage(doc, exam, student, variantCode, { qrUrl, photoData });
        }
        
        previewPdf(doc, `bulk-omr-${exam.name}.pdf`);
    } catch (err) {
        console.error("Bulk OMR generation failed:", err);
        throw err;
    }
}

