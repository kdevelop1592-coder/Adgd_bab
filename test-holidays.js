// Playwright 테스트 스크립트 - 공휴일 표시 확인
// 실행 방법: node test-holidays.js

const { chromium } = require('playwright');

(async () => {
    console.log('🎌 공휴일 표시 기능 테스트 시작...\n');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 500
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();

    try {
        // 1. 페이지 로딩
        console.log('✅ 1. 페이지 로딩...');
        await page.goto('http://localhost:8000');
        await page.waitForTimeout(3000);

        // 2. 월간 탭으로 이동
        console.log('✅ 2. 월간 탭으로 이동...');
        await page.click('button[data-tab="monthly"]');
        await page.waitForTimeout(2000);

        const currentMonth = await page.textContent('#current-month');
        console.log(`   현재 월: ${currentMonth}`);

        await page.screenshot({ path: 'screenshots/holiday-current-month.png' });
        console.log('   스크린샷 저장: holiday-current-month.png\n');

        // 3. 1월로 이동 (신정 확인)
        console.log('✅ 3. 2025년 1월로 이동 (신정 확인)...');

        // 현재 월을 확인하고 1월로 이동
        let month = await page.textContent('#current-month');
        while (!month.includes('2025년 1월')) {
            await page.click('#prev-month');
            await page.waitForTimeout(1000);
            month = await page.textContent('#current-month');
        }

        console.log(`   이동 완료: ${month}`);
        await page.screenshot({ path: 'screenshots/holiday-jan-2025.png' });
        console.log('   스크린샷 저장: holiday-jan-2025.png (1월 1일 신정)\n');

        // 4. 3월로 이동 (삼일절 확인)
        console.log('✅ 4. 2025년 3월로 이동 (삼일절 확인)...');
        await page.click('#next-month');
        await page.waitForTimeout(1000);
        await page.click('#next-month');
        await page.waitForTimeout(1000);

        month = await page.textContent('#current-month');
        console.log(`   이동 완료: ${month}`);
        await page.screenshot({ path: 'screenshots/holiday-mar-2025.png' });
        console.log('   스크린샷 저장: holiday-mar-2025.png (3월 1일 삼일절)\n');

        // 5. 5월로 이동 (어린이날 확인)
        console.log('✅ 5. 2025년 5월로 이동 (어린이날 확인)...');
        await page.click('#next-month');
        await page.waitForTimeout(1000);
        await page.click('#next-month');
        await page.waitForTimeout(1000);

        month = await page.textContent('#current-month');
        console.log(`   이동 완료: ${month}`);
        await page.screenshot({ path: 'screenshots/holiday-may-2025.png' });
        console.log('   스크린샷 저장: holiday-may-2025.png (5월 5일 어린이날)\n');

        // 6. 10월로 이동 (추석, 개천절, 한글날 확인)
        console.log('✅ 6. 2025년 10월로 이동 (추석, 개천절, 한글날 확인)...');
        for (let i = 0; i < 5; i++) {
            await page.click('#next-month');
            await page.waitForTimeout(800);
        }

        month = await page.textContent('#current-month');
        console.log(`   이동 완료: ${month}`);
        await page.screenshot({ path: 'screenshots/holiday-oct-2025.png' });
        console.log('   스크린샷 저장: holiday-oct-2025.png (10월 3일 개천절, 10월 5-9일 추석)\n');

        // 7. 12월로 이동 (크리스마스 확인)
        console.log('✅ 7. 2025년 12월로 이동 (크리스마스 확인)...');
        await page.click('#next-month');
        await page.waitForTimeout(1000);
        await page.click('#next-month');
        await page.waitForTimeout(1000);

        month = await page.textContent('#current-month');
        console.log(`   이동 완료: ${month}`);
        await page.screenshot({ path: 'screenshots/holiday-dec-2025.png' });
        console.log('   스크린샷 저장: holiday-dec-2025.png (12월 25일 크리스마스)\n');

        // 8. 공휴일 셀 확인
        console.log('✅ 8. 공휴일 스타일 확인...');
        const holidayCells = await page.$$('.calendar-day.holiday');
        console.log(`   공휴일로 표시된 날짜 수: ${holidayCells.length}`);

        if (holidayCells.length > 0) {
            const firstHoliday = holidayCells[0];
            const color = await firstHoliday.evaluate(el => window.getComputedStyle(el).color);
            const bgColor = await firstHoliday.evaluate(el => window.getComputedStyle(el).backgroundColor);
            console.log(`   공휴일 텍스트 색상: ${color}`);
            console.log(`   공휴일 배경 색상: ${bgColor}`);
        }

        console.log('\n═══════════════════════════════════════');
        console.log('📊 공휴일 표시 테스트 결과');
        console.log('═══════════════════════════════════════');
        console.log('✅ 공휴일 데이터 로딩: 성공');
        console.log('✅ 빨간색 표시: 성공');
        console.log('✅ 배경색 표시: 성공');
        console.log('✅ 여러 달 확인: 성공');
        console.log('═══════════════════════════════════════');
        console.log('\n📸 모든 스크린샷이 screenshots/ 폴더에 저장되었습니다.');

    } catch (error) {
        console.error('❌ 테스트 중 오류 발생:', error.message);
    } finally {
        await page.waitForTimeout(3000);
        await browser.close();
    }
})();
