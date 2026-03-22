const https = require('https');
https.get('https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&ATPT_OFCDC_SC_CODE=R10&SD_SCHUL_CODE=8750186&MLSV_YMD=20240315', (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            const parsedData = JSON.parse(rawData);
            console.log(JSON.stringify(parsedData.mealServiceDietInfo[1].row[0], null, 2));
        } catch (e) {
            console.error(e.message);
        }
    });
});
