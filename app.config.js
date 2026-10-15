// GitHub Pages: เว็บอยู่ใต้ /Mhobaan-App/ → ตั้ง baseUrl เฉพาะตอน export (GH_PAGES=1) · dev / iOS ใช้ค่าเดิมจาก app.json
module.exports = ({ config }) => (process.env.GH_PAGES ? { ...config, experiments: { ...config.experiments, baseUrl: '/Mhobaan-App' } } : config);
