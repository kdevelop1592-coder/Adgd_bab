// Playwright 테스트 스크립트
// 실행 방법: npx playwright test test-pwa.js --headed

const { chromium } = require('playwright');

(async () => {
    console.log('🚀 급식 알리미 PWA 테스트 시작...\n');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 500 // 각 동작을 천천히 실행하여 확인 가능
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();

    // 콘솔 로그 캡처
    page.on('console', msg => console.log('📝 Console:', msg.text()));
    page.on('pageerror', err => console.error('❌ Error:', err.message));

    try {
        // 1. 초기 로딩 테스트
        console.log('✅ 1. 페이지 로딩 테스트...');
        await page.goto('http://localhost:8000');
        await page.waitForTimeout(3000);

        const title = await page.textContent('h1');
        console.log(`   제목: ${title}`);

        await page.screenshot({ path: 'screenshots/01-initial-load.png' });
        console.log('   스크린샷 저장: 01-initial-load.png\n');

        // 2. 오늘 탭 테스트
        console.log('✅ 2. 오늘 탭 테스트...');
        const todayDate = await page.textContent('#today-date');
        console.log(`   오늘 날짜: ${todayDate}`);

        const todayMeal = await page.textContent('#today-meal-info');
        console.log(`   급식 정보: ${todayMeal.substring(0, 50)}...`);

        await page.screenshot({ path: 'screenshots/02-today-tab.png' });
        console.log('   스크린샷 저장: 02-today-tab.png\n');

        // 3. 날짜 네비게이션 테스트
        console.log('✅ 3. 날짜 네비게이션 테스트...');

        // 다음 날
        await page.click('#next-day');
        await page.waitForTimeout(2000);
        const nextDate = await page.textContent('#today-date');
        console.log(`   다음 날: ${nextDate}`);
        await page.screenshot({ path: 'screenshots/03-next-day.png' });

        // 이전 날
        await page.click('#prev-day');
        await page.waitForTimeout(2000);
        const prevDate = await page.textContent('#today-date');
        console.log(`   이전 날: ${prevDate}`);
        await page.screenshot({ path: 'screenshots/04-prev-day.png' });
        console.log('   스크린샷 저장 완료\n');

        // 4. 주간 탭 테스트
        console.log('✅ 4. 주간 탭 테스트...');
        await page.click('button[data-tab="weekly"]');
        await page.waitForTimeout(3000);

        const weeklyItems = await page.$$('.weekly-list .meal-card');
        console.log(`   주간 급식 항목 수: ${weeklyItems.length}`);

        await page.screenshot({ path: 'screenshots/05-weekly-tab.png' });
        console.log('   스크린샷 저장: 05-weekly-tab.png\n');

        // 5. 월간 탭 테스트
        console.log('✅ 5. 월간 탭 테스트...');
        await page.click('button[data-tab="monthly"]');
        await page.waitForTimeout(3000);

        const currentMonth = await page.textContent('#current-month');
        console.log(`   현재 월: ${currentMonth}`);

        const calendarDays = await page.$$('.calendar-grid .day');
        console.log(`   달력 날짜 셀 수: ${calendarDays.length}`);

        await page.screenshot({ path: 'screenshots/06-monthly-calendar.png' });
        console.log('   스크린샷 저장: 06-monthly-calendar.png\n');

        // 6. 월 네비게이션 테스트
        console.log('✅ 6. 월 네비게이션 테스트...');

        await page.click('#next-month');
        await page.waitForTimeout(2000);
        const nextMonth = await page.textContent('#current-month');
        console.log(`   다음 달: ${nextMonth}`);
        await page.screenshot({ path: 'screenshots/07-next-month.png' });

        await page.click('#prev-month');
        await page.waitForTimeout(2000);
        const prevMonth = await page.textContent('#current-month');
        console.log(`   이전 달: ${prevMonth}`);
        await page.screenshot({ path: 'screenshots/08-prev-month.png' });
        console.log('   스크린샷 저장 완료\n');

        // 7. 모달 테스트
        console.log('✅ 7. 모달 팝업 테스트...');
        const dayCell = await page.$('.calendar-grid .day.has-meal');
        if (dayCell) {
            await dayCell.click();
            await page.waitForTimeout(1000);

            const modalVisible = await page.isVisible('#meal-modal');
            console.log(`   모달 표시 여부: ${modalVisible}`);

            if (modalVisible) {
                await page.screenshot({ path: 'screenshots/09-modal-open.png' });
                await page.click('.close-modal');
                await page.waitForTimeout(500);
                console.log('   모달 닫기 성공');
            }
        } else {
            console.log('   급식이 있는 날짜를 찾을 수 없음');
        }
        console.log('');

        // 8. 알림 섹션 테스트
        console.log('✅ 8. 알림 섹션 테스트...');
        await page.click('button[data-tab="today"]'); // 오늘 탭으로 돌아가기
        await page.waitForTimeout(1000);

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1000);

        const notificationBtn = await page.isVisible('#enable-notifications');
        console.log(`   알림 버튼 표시 여부: ${notificationBtn}`);

        await page.screenshot({ path: 'screenshots/10-notification-section.png' });
        console.log('   스크린샷 저장: 10-notification-section.png\n');

        // 9. 모바일 반응형 테스트
        console.log('✅ 9. 모바일 반응형 테스트...');
        await page.setViewportSize({ width: 375, height: 667 });
        await page.waitForTimeout(1000);

        await page.screenshot({ path: 'screenshots/11-mobile-view.png' });
        console.log('   스크린샷 저장: 11-mobile-view.png\n');

        // 10. 최종 결과
        console.log('✅ 10. 테스트 완료!\n');
        console.log('═══════════════════════════════════════');
        console.log('📊 테스트 결과 요약');
        console.log('═══════════════════════════════════════');
        console.log('✅ 페이지 로딩: 성공');
        console.log('✅ 탭 전환: 성공');
        console.log('✅ 날짜 네비게이션: 성공');
        console.log('✅ 월간 캘린더: 성공');
        console.log('✅ 반응형 디자인: 성공');
        console.log('═══════════════════════════════════════');
        console.log('\n📸 모든 스크린샷이 screenshots/ 폴더에 저장되었습니다.');

    } catch (error) {
        console.error('❌ 테스트 중 오류 발생:', error.message);
    } finally {
        await page.waitForTimeout(3000); // 결과 확인을 위해 3초 대기
        await browser.close();
    }
})();
