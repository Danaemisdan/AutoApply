const pdf = require('pdf-parse');
const mammoth = require('mammoth');

class FileParser {
  /**
   * Extract text from PDF buffer
   */
  async extractTextFromPDF(buffer) {
    try {
      const data = await pdf(buffer);
      return data.text.trim();
    } catch (error) {
      console.error('Error parsing PDF:', error);
      throw new Error('Failed to parse PDF file. Please ensure it\'s a valid PDF document.');
    }
  }

  /**
   * Extract text from DOCX buffer
   */
  async extractTextFromDocx(buffer) {
    try {
      const result = await mammoth.extractRawText({ buffer: buffer });
      return result.value.trim();
    } catch (error) {
      console.error('Error parsing DOCX:', error);
      throw new Error('Failed to parse DOCX file. Please ensure it\'s a valid Word document.');
    }
  }

  /**
   * Extract text from TXT buffer
   */
  async extractTextFromTxt(buffer) {
    try {
      const text = buffer.toString('utf-8');
      return text.trim();
    } catch (error) {
      console.error('Error parsing TXT:', error);
      throw new Error('Failed to parse text file.');
    }
  }

  /**
   * Main parser function that determines file type and extracts text
   */
  async parseFile(buffer, fileName) {
    try {
      const fileExtension = this.getFileExtension(fileName);
      
      switch (fileExtension.toLowerCase()) {
        case 'pdf':
          return await this.extractTextFromPDF(buffer);
        
        case 'docx':
        case 'doc':
          return await this.extractTextFromDocx(buffer);
        
        case 'txt':
          return await this.extractTextFromTxt(buffer);
        
        default:
          throw new Error(`Unsupported file type: ${fileExtension}. Please upload a PDF, DOCX, or TXT file.`);
      }
    } catch (error) {
      console.error('Error in parseFile:', error);
      throw error;
    }
  }

  /**
   * Get file extension from filename
   */
  getFileExtension(fileName) {
    if (!fileName) return '';
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  /**
   * Validate file size (max 10MB)
   */
  validateFileSize(buffer, maxSizeMB = 10) {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (buffer.length > maxSizeBytes) {
      throw new Error(`File size too large. Maximum allowed size is ${maxSizeMB}MB.`);
    }
    return true;
  }

  /**
   * Validate extracted text
   */
  validateExtractedText(text) {
    if (!text || text.trim().length === 0) {
      throw new Error('No text could be extracted from the file. Please ensure the file contains readable text.');
    }
    
    if (text.trim().length < 50) {
      throw new Error('Extracted text is too short. Please ensure your resume contains sufficient content.');
    }

    return text.trim();
  }

  /**
   * Clean and format extracted text
   */
  cleanText(text) {
    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim();
  }
}

module.exports = new FileParser(); 