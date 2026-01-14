const ExcelJS = require('exceljs');

/**
 * Excel Generator Utility
 * 엑셀 파일 생성을 위한 유틸리티 모듈 (ExcelJS 사용)
 */
class ExcelGenerator {
  /**
   * 새 워크북 생성
   * @returns {ExcelJS.Workbook} 빈 워크북
   */
  createWorkbook() {
    return new ExcelJS.Workbook();
  }

  /**
   * 모니터링 시트 추가 (프로그램별 그룹핑)
   * @param {ExcelJS.Workbook} workbook - 워크북
   * @param {Object} data - { programGroups: [{ programId, programName, dateColumns, participants, matrix }] }
   * @param {Object} options - { month }
   * @returns {ExcelJS.Workbook} 업데이트된 워크북
   */
  addMonitoringSheet(workbook, data, options = {}) {
    const { programGroups } = data;
    const { month } = options;

    if (!programGroups || programGroups.length === 0) {
      // 데이터가 없으면 빈 시트
      const worksheet = workbook.addWorksheet('모니터링');
      worksheet.getCell('A1').value = '데이터가 없습니다.';
      return workbook;
    }

    // 전체 날짜 컬럼 수집 (모든 프로그램의 날짜 통합)
    const allDateColumns = new Set();
    programGroups.forEach(group => {
      group.dateColumns.forEach(date => allDateColumns.add(date));
    });
    const sortedDateColumns = Array.from(allDateColumns).sort((a, b) => {
      const [aMonth, aDay] = a.split('.').map(Number);
      const [bMonth, bDay] = b.split('.').map(Number);
      return aMonth !== bMonth ? aMonth - bMonth : aDay - bDay;
    });

    // 시트명 생성
    const sheetName = month ? `모니터링_${month}` : '모니터링';
    const worksheet = workbook.addWorksheet(sheetName.substring(0, 31));

    // 헤더 생성
    const headers = ['프로그램명', '순번', '닉네임', '이름', ...sortedDateColumns, '인증개수'];
    const headerRow = worksheet.addRow(headers);

    // 헤더 스타일 적용 (연보라색 배경, 굵은 글씨, 가운데 맞춤)
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6E6FA' }  // 연보라색
      };
      cell.font = {
        bold: true
      };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle'
      };
    });

    // 컬럼 너비 설정
    worksheet.getColumn(1).width = 35;  // 프로그램명 (넉넉하게)
    worksheet.getColumn(2).width = 6;   // 순번
    worksheet.getColumn(3).width = 15;  // 닉네임
    worksheet.getColumn(4).width = 10;  // 이름
    for (let i = 0; i < sortedDateColumns.length; i++) {
      worksheet.getColumn(5 + i).width = 5;  // 날짜들
    }
    worksheet.getColumn(5 + sortedDateColumns.length).width = 10;  // 인증개수

    let currentRow = 2; // 1은 헤더

    // 프로그램별로 데이터 추가
    programGroups.forEach((group, groupIndex) => {
      const { programName, participants, matrix, dateColumns } = group;
      const groupStartRow = currentRow;
      let programTotalCerts = 0;

      participants.forEach((participant, index) => {
        const userMatrix = matrix[participant.userId] || {};
        
        // 각 날짜별 체크박스 값
        const dateValues = sortedDateColumns.map(dateKey => {
          if (!dateColumns.includes(dateKey)) {
            return '-'; // 활동기간 외
          }
          return userMatrix[dateKey] ? '☑' : '☐';
        });

        // 인증 개수 계산 (활동기간 내에서만)
        const certCount = dateColumns.filter(dateKey => userMatrix[dateKey]).length;
        programTotalCerts += certCount;

        const row = worksheet.addRow([
          index === 0 ? programName : '', // 첫 행에만 프로그램명
          index + 1, // 순번 (1부터 시작)
          participant.nickname || '',
          participant.name || '',
          ...dateValues,
          certCount
        ]);

        // 프로그램명 셀 스타일 (가운데 맞춤, 굵은 글씨)
        if (index === 0) {
          row.getCell(1).font = { bold: true };
          row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        }

        // 순번 셀 가운데 맞춤
        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };

        currentRow++;
      });

      // 프로그램명 셀 병합 (참가자가 2명 이상일 때만)
      if (participants.length > 1) {
        worksheet.mergeCells(groupStartRow, 1, currentRow - 1, 1);
      }

      // 프로그램별 총 인증글 개수 행 + 일차 표시
      const dayLabels = sortedDateColumns.map(dateKey => {
        if (!dateColumns.includes(dateKey)) {
          return ''; // 활동기간 외
        }
        
        // 활동기간 내에서 몇 일차인지 계산
        const dayIndex = dateColumns.indexOf(dateKey);
        const dayNum = dayIndex + 1;
        
        if (dayNum === 1) return '첫날';
        if (dayNum % 5 === 0) return `${dayNum}일차`;
        return '';
      });
      
      const totalRow = worksheet.addRow([
        '', '', '', '총계', 
        ...dayLabels, 
        programTotalCerts
      ]);

      // 총계 행 스타일
      totalRow.getCell(4).font = { bold: true };
      totalRow.getCell(4 + sortedDateColumns.length + 1).font = { bold: true };

      currentRow++;

      // 프로그램 사이에 빈 행 추가 (마지막 프로그램 제외)
      if (groupIndex < programGroups.length - 1) {
        worksheet.addRow([]);
        currentRow++;
      }
    });

    return workbook;
  }

  /**
   * 워크북을 Buffer로 변환
   * @param {ExcelJS.Workbook} workbook - 워크북
   * @returns {Promise<Buffer>} 엑셀 파일 버퍼
   */
  async exportToBuffer(workbook) {
    return await workbook.xlsx.writeBuffer();
  }

  /**
   * 날짜 포맷팅 (KST)
   * @param {Date} date - 날짜 객체
   * @returns {string} YYYY-MM-DD HH:mm:ss 형식
   */
  formatDate(date) {
    if (!date) return '';
    
    const d = date instanceof Date ? date : new Date(date);
    
    // KST 변환 (+9시간)
    const kstDate = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    
    const year = kstDate.getUTCFullYear();
    const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(kstDate.getUTCDate()).padStart(2, '0');
    const hours = String(kstDate.getUTCHours()).padStart(2, '0');
    const minutes = String(kstDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(kstDate.getUTCSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * API 1: 스토어 구매 명단 시트 추가
   * @param {ExcelJS.Workbook} workbook - 워크북
   * @param {Array} data - 구매 명단 데이터
   * @param {Object} options - { month }
   * @returns {ExcelJS.Workbook} 업데이트된 워크북
   */
  addStorePurchaseSheet(workbook, data, options = {}) {
    const { month } = options;
    const sheetName = month ? `스토어_구매명단_${month}` : '스토어_구매명단';
    const worksheet = workbook.addWorksheet(sheetName.substring(0, 31));

    if (!data || data.length === 0) {
      worksheet.getCell('A1').value = '데이터가 없습니다.';
      return workbook;
    }

    // 헤더 생성
    const headers = ['순번', '사용자ID', '닉네임', '이름', '사용한 나다움 포인트(N)', '상품명', '구매일'];
    const headerRow = worksheet.addRow(headers);

    // 헤더 스타일 적용
    this._applyHeaderStyle(headerRow);

    // 컬럼 너비 설정
    worksheet.getColumn(1).width = 6;   // 순번
    worksheet.getColumn(2).width = 30;  // 사용자ID
    worksheet.getColumn(3).width = 15;  // 닉네임
    worksheet.getColumn(4).width = 10;  // 이름
    worksheet.getColumn(5).width = 20;  // 사용한 나다움 포인트
    worksheet.getColumn(6).width = 25;  // 상품명
    worksheet.getColumn(7).width = 20;  // 구매일

    // 데이터 행 추가
    data.forEach((item, index) => {
      worksheet.addRow([
        index + 1,
        item.userId,
        item.nickname,
        item.name,
        item.usedPoints,
        item.productName,
        this.formatDate(item.purchaseDate),
      ]);
    });

    // 총계 행 추가
    const totalPoints = data.reduce((sum, item) => sum + (item.usedPoints || 0), 0);
    const totalRow = worksheet.addRow(['', '', '', '총계', totalPoints, '', '']);
    totalRow.getCell(4).font = { bold: true };
    totalRow.getCell(5).font = { bold: true };

    return workbook;
  }

  /**
   * API 2: 월별 참여자 나다움 적립/차감 명단 시트 추가
   * @param {ExcelJS.Workbook} workbook - 워크북
   * @param {Object} data - { users: Array, months: string[] }
   * @param {Object} options - 추가 옵션
   * @returns {ExcelJS.Workbook} 업데이트된 워크북
   */
  addMonthlySummarySheet(workbook, data, options = {}) {
    const { users, months } = data;
    const sheetName = '월별_나다움_요약';
    const worksheet = workbook.addWorksheet(sheetName.substring(0, 31));

    if (!users || users.length === 0) {
      worksheet.getCell('A1').value = '데이터가 없습니다.';
      return workbook;
    }

    // 헤더 생성: 순번, 사용자ID, 닉네임, 이름, 이전 누적, [월별 적립/사용/차감], 현재 보유
    const monthHeaders = months.flatMap(m => {
      const monthNum = m.split('-')[1];
      return [`${monthNum}월 적립`, `${monthNum}월 사용`, `${monthNum}월 차감`];
    });
    const headers = ['순번', '사용자ID', '닉네임', '이름', '이전 누적', ...monthHeaders, '현재 보유'];
    const headerRow = worksheet.addRow(headers);

    // 헤더 스타일 적용
    this._applyHeaderStyle(headerRow);

    // 컬럼 너비 설정
    worksheet.getColumn(1).width = 6;   // 순번
    worksheet.getColumn(2).width = 30;  // 사용자ID
    worksheet.getColumn(3).width = 15;  // 닉네임
    worksheet.getColumn(4).width = 10;  // 이름
    worksheet.getColumn(5).width = 12;  // 이전 누적
    for (let i = 0; i < monthHeaders.length; i++) {
      worksheet.getColumn(6 + i).width = 12;
    }
    worksheet.getColumn(6 + monthHeaders.length).width = 12; // 현재 보유

    // 데이터 행 추가
    users.forEach((user, index) => {
      const monthValues = months.flatMap(m => {
        const monthData = user.monthlyData[m] || { earned: 0, used: 0, deducted: 0 };
        return [monthData.earned, monthData.used, monthData.deducted];
      });

      worksheet.addRow([
        index + 1,
        user.userId,
        user.nickname,
        user.name,
        user.previousTotal,
        ...monthValues,
        user.currentRewards,
      ]);
    });

    // 총계 행 추가
    const totals = {
      previousTotal: users.reduce((sum, u) => sum + (u.previousTotal || 0), 0),
      currentRewards: users.reduce((sum, u) => sum + (u.currentRewards || 0), 0),
    };
    const monthTotals = months.flatMap(m => {
      const earned = users.reduce((sum, u) => sum + ((u.monthlyData[m]?.earned) || 0), 0);
      const used = users.reduce((sum, u) => sum + ((u.monthlyData[m]?.used) || 0), 0);
      const deducted = users.reduce((sum, u) => sum + ((u.monthlyData[m]?.deducted) || 0), 0);
      return [earned, used, deducted];
    });

    const totalRow = worksheet.addRow([
      '', '', '', '총계',
      totals.previousTotal,
      ...monthTotals,
      totals.currentRewards,
    ]);
    totalRow.getCell(4).font = { bold: true };

    return workbook;
  }

  /**
   * API 3: 나다움 적립/차감 내역 시트 추가
   * @param {ExcelJS.Workbook} workbook - 워크북
   * @param {Array} data - 적립/차감 내역 데이터
   * @param {Object} options - { month }
   * @returns {ExcelJS.Workbook} 업데이트된 워크북
   */
  addRewardHistorySheet(workbook, data, options = {}) {
    const { month } = options;
    const sheetName = month ? `적립차감_내역_${month}` : '적립차감_내역';
    const worksheet = workbook.addWorksheet(sheetName.substring(0, 31));

    if (!data || data.length === 0) {
      worksheet.getCell('A1').value = '데이터가 없습니다.';
      return workbook;
    }

    // 헤더 생성 (이미지 참고: 사용자 ID, 사용자 이름, 발생 일시, 소멸 예정 일시, 수량/금액, 내역 구분, 사유, 관리자 메뉴/부가 설명)
    const headers = ['순번', '사용자 ID', '사용자 이름', '발생 일시', '소멸 예정 일시', '수량/금액', '내역 구분', '사유', '관리자 메뉴/부가 설명'];
    const headerRow = worksheet.addRow(headers);

    // 헤더 스타일 적용
    this._applyHeaderStyle(headerRow);

    // 컬럼 너비 설정
    worksheet.getColumn(1).width = 6;   // 순번
    worksheet.getColumn(2).width = 30;  // 사용자 ID
    worksheet.getColumn(3).width = 12;  // 사용자 이름
    worksheet.getColumn(4).width = 20;  // 발생 일시
    worksheet.getColumn(5).width = 20;  // 소멸 예정 일시
    worksheet.getColumn(6).width = 12;  // 수량/금액
    worksheet.getColumn(7).width = 10;  // 내역 구분
    worksheet.getColumn(8).width = 25;  // 사유
    worksheet.getColumn(9).width = 25;  // 관리자 메뉴/부가 설명

    // 데이터 행 추가
    data.forEach((item, index) => {
      worksheet.addRow([
        index + 1,
        item.userId,
        item.userName,
        this.formatDate(item.createdAt),
        item.expiresAt ? this.formatDate(item.expiresAt) : '-',
        item.amount,
        item.changeType,
        item.reason,
        item.actionKey,
      ]);
    });

    return workbook;
  }

  /**
   * 헤더 스타일 적용 (공통)
   * @param {ExcelJS.Row} headerRow - 헤더 행
   */
  _applyHeaderStyle(headerRow) {
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6E6FA' }  // 연보라색
      };
      cell.font = {
        bold: true
      };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle'
      };
    });
  }
}

module.exports = new ExcelGenerator();
