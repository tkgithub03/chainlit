import { marked } from 'marked';
import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';

import IconButton, { IconButtonProps } from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import DownloadIcon from 'assets/download';

interface ExportExcelButtonProps {
  value: string;
  filename: string;
  theme?: 'dark' | 'light';
  edge?: IconButtonProps['edge'];
}

const ExportExcelButton = ({
  value,
  filename,
  edge
}: ExportExcelButtonProps): JSX.Element => {
  const [tableData, setTableData] = useState<any[][][]>([]);

  useEffect(() => {
    if (!value) return;
    const data = exportMarkdownToExcel(value);
    setTableData(data);
  }, [value]);

  const exportMarkdownToExcel = (markdownContent: string) => {
    // Convert Markdown to HTML
    const htmlContent = marked(markdownContent).toString();

    // Extract table data from HTML
    const tableData = extractTableDataFromHTML(htmlContent);

    return tableData;
    // Export to Excel
    // exportToExcel(tableData, fileName);
  };

  const decodeHTMLEntities = (text: string): string => {
    const txt = document.createElement('textarea');
    txt.innerHTML = text;
    return txt.value;
  };

  const extractTableDataFromHTML = (html: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const tables = doc.querySelectorAll('table');

    const tableData: any[] = [];

    tables.forEach((table) => {
      const rows = table.querySelectorAll('tr');
      const sheetData: any[] = [];

      rows.forEach((row) => {
        const rowData: any[] = [];
        const cells = row.querySelectorAll('td, th');

        cells.forEach((cell) => {
          const cellContent = (cell.innerHTML || '').replace(
            /<br\s*\/?>/gi,
            '\n'
          );
          rowData.push({ v: decodeHTMLEntities(cellContent), t: 's' }); // Thêm wrapText cho từng ô
        });

        sheetData.push(rowData);
      });

      tableData.push(sheetData);
    });

    return tableData;
  };
  // Hàm tính toán chiều cao của từng hàng dựa trên nội dung
  const calculateRowHeights = (data: any[][]): number[] => {
    const rowHeights = data.map((row) => {
      const maxLines = Math.max(
        ...row.map((cell) => {
          const lines = cell.v.split('\n').length; // Số dòng trong ô
          return lines;
        })
      );
      return maxLines * 15; // 15 là chiều cao mỗi dòng, bạn có thể điều chỉnh
    });
    return rowHeights;
  };

  // Hàm xuất dữ liệu ra file Excel
  const exportToExcel = (tableData: any[][][], fileName: string) => {
    if (!tableData.length) return;
    const workbook = XLSX.utils.book_new();

    tableData.forEach((data, index) => {
      const worksheet = XLSX.utils.aoa_to_sheet(data);

      // Auto-fit column width
      const colWidths = data[0].map((_, colIndex) => {
        const maxLength = Math.max(
          ...data.map((row) => (row[colIndex] ? row[colIndex].v.length : 0))
        );
        return { wch: maxLength + 2 }; // Thêm 2 để có khoảng cách
      });

      worksheet['!cols'] = colWidths;

      // Bật wrap text cho tất cả các ô
      Object.keys(worksheet).forEach((cellKey) => {
        if (worksheet[cellKey] && worksheet[cellKey].v) {
          worksheet[cellKey].s = { alignment: { wrapText: true } };
        }
      });

      // Tính toán chiều cao hàng và đặt chiều cao
      const rowHeights = calculateRowHeights(data);
      worksheet['!rows'] = rowHeights.map((height) => ({ hpt: height })); // hpt: chiều cao theo đơn vị points

      XLSX.utils.book_append_sheet(workbook, worksheet, `Table${index + 1}`);
    });

    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  };

  const handleDownload = () => {
    exportToExcel(tableData, filename);
  };

  if (!tableData.length) return <></>;

  return (
    <Tooltip title={'Download Excel'} onClose={() => {}} sx={{ zIndex: 2 }}>
      <IconButton color="inherit" edge={edge} onClick={handleDownload}>
        <DownloadIcon sx={{ height: 16, width: 16 }} />
      </IconButton>
    </Tooltip>
  );
};

export { ExportExcelButton };
