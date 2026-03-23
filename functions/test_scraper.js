const cheerio = require('cheerio');

async function testScraper(year, month) {
    const paddedMonth = String(month).padStart(2, '0');
    const url = `https://school.gyo6.net/adgd/ad/fm/foodmenu/selectFoodMenuView.do?mi=100561&viewType=tbl&schYy=${year}&schMm=${paddedMonth}`;
    
    console.log(`Fetching: ${url}`);
    
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    try {
        // Step 1: Get session
        const mainResponse = await fetch('https://school.gyo6.net/adgd/main.do', { headers });
        const setCookies = mainResponse.headers.get('set-cookie');
        const cookies = setCookies ? setCookies.split(',').map(c => c.split(';')[0]).join('; ') : '';
        console.log('Cookies obtained');

        // Step 2: Get meal page
        const response = await fetch(url, {
            headers: { ...headers, 'Cookie': cookies }
        });
        const html = await response.text();
        const $ = cheerio.load(html);
        
        console.log('HTML loaded, parsing cells...');

        $('td.selectDay').each((_, td) => {
            const $td = $(td);
            const dateStr = $td.attr('id');
            if (!dateStr || !dateStr.startsWith(year)) return;

            const $img = $td.find('.meal_tab_icon img').first();
            if ($img.length > 0) {
                const imgSrc = $img.attr('src');
                console.log(`Date: ${dateStr}, Img: ${imgSrc}`);
            }
        });
        
        // Check for specific date
        const today = '20260323';
        const todayTd = $(`td#${today}`);
        console.log(`\nSpecific check for ${today}:`);
        if (todayTd.length > 0) {
            console.log('TD found');
            const img = todayTd.find('img');
            console.log('Images found count:', img.length);
            img.each((i, el) => {
                console.log(`Img ${i} src:`, $(el).attr('src'));
            });
        } else {
            console.log('TD NOT found');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

testScraper('2026', '3');
