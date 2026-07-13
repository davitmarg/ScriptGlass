import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import { ScriptBlock } from '@/src/types';

interface TitlePageData {
  title: string;
  credit: string;
  author: string;
  source: string;
  notes: string;
  contact: string;
}

export const exportToPDF = (
  blocks: ScriptBlock[],
  titlePage: TitlePageData,
  activeFile: string | null
) => {
  try {
    const doc = new jsPDF({ unit: 'in', format: 'letter' });
    doc.setFont('courier', 'normal');
    doc.setFontSize(12);
    
    // Title Page logic
    if (titlePage.title || titlePage.author) {
      let titleY = 4.0;
      
      if (titlePage.title) {
        doc.setFont('courier', 'bold');
        const titleLines = doc.splitTextToSize(titlePage.title, 5.0);
        titleLines.forEach((line: string) => {
          doc.text(line, 4.25, titleY, { align: 'center' });
          titleY += 0.25;
        });
        titleY += 0.5;
      }
      
      doc.setFont('courier', 'normal');
      if (titlePage.credit) {
        doc.text(titlePage.credit, 4.25, titleY, { align: 'center' });
        titleY += 0.25;
      }
      
      if (titlePage.author) {
        doc.text(titlePage.author, 4.25, titleY, { align: 'center' });
      }
      
      if (titlePage.source) {
        doc.text(titlePage.source, 4.25, titleY + 0.5, { align: 'center' });
      }
      
      if (titlePage.contact) {
        doc.setFontSize(10);
        const contactLines = doc.splitTextToSize(titlePage.contact, 3.0);
        doc.text(contactLines, 1.0, 10.0);
        doc.setFontSize(12);
      }
      
      doc.addPage();
    }

    let y = 1.0; // Start at top margin
    const bottomMargin = 10.0;
    const lineHeight = 1/6;

    blocks.forEach((block, index) => {
      let x = 1.5;
      let width = 6.0;
      let align = 'left';
      
      if (block.type === 'character') { 
        x = 3.7; 
        width = 3.8; 
        doc.setFont('courier', 'bold');
      } else if (block.type === 'scene') {
        doc.setFont('courier', 'bold');
      } else if (block.type === 'parenthetical') { 
        x = 3.1; 
        width = 2.0; 
        doc.setFont('courier', 'normal');
      } else if (block.type === 'dialogue') { 
        x = 2.5; 
        width = 3.5; 
        doc.setFont('courier', 'normal');
      } else if (block.type === 'transition') { 
        x = 5.5; 
        width = 2.0; 
        align = 'right'; 
        doc.setFont('courier', 'normal');
      } else {
        doc.setFont('courier', 'normal');
      }
      
      const splitText = doc.splitTextToSize(block.content, width);
      const blockHeight = splitText.length * lineHeight;
      
      let spacing = lineHeight;
      if (index === 0) spacing = 0;
      else if (block.type === 'dialogue' || block.type === 'parenthetical') spacing = 0;

      if (y + spacing + blockHeight > bottomMargin) {
        doc.addPage();
        y = 1.0;
        spacing = 0;
      }
      
      y += spacing;
      
      splitText.forEach((line: string) => {
        if (align === 'right') {
          doc.text(line, 7.5, y, { align: 'right' });
        } else {
          doc.text(line, x, y);
        }
        y += lineHeight;
      });
    });
    
    doc.save(`${activeFile?.replace('.fountain', '') || 'script'}.pdf`);
    toast.success('Script exported to PDF');
  } catch (error) {
    console.error('Export failed', error);
    toast.error('Failed to export PDF');
  }
};
