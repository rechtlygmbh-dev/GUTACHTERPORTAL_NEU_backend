const axios = require('axios');
const Minio = require('minio');
const Case = require('../models/Case');

// MinIO-Konfiguration (wie in server.js)
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT?.replace(/^https?:\/\//, '') || 'localhost',
  port: parseInt(process.env.MINIO_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ROOT_USER,
  secretKey: process.env.MINIO_ROOT_PASSWORD
});
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'gutachten';

exports.handleDocusealWebhook = async (req, res) => {
  try {
    const { document, signer, fields } = req.body;
    // document.pdf_url enthält das signierte PDF
    // fields enthält ggf. die Fall-ID oder E-Mail

    // PDF herunterladen
    const pdfResponse = await axios.get(document.pdf_url, { responseType: 'arraybuffer' });
    const pdfBuffer = Buffer.from(pdfResponse.data);

    // Fall zuordnen (z. B. über E-Mail oder ein custom field)
    const fall = await Case.findOne({ 'mandant.email': signer.email });
    if (!fall) return res.status(404).json({ erfolg: false, nachricht: 'Fall nicht gefunden' });

    // MinIO-Pfad bauen
    const minioPath = `GUTACHTER/${fall.gutachterNummer || '00000'}/${fall.fallNummer?.toString().padStart(5, '0') || '00000'}/${fall.mandant?.mandantennummer || 'UNBEKANNT'}/datenschutz/datenschutzerklaerung_signiert.pdf`;

    // PDF in MinIO speichern
    await minioClient.putObject(MINIO_BUCKET, minioPath, pdfBuffer);

    // Fall aktualisieren (z. B. Flag setzen)
    fall.datenschutzUnterschrieben = true;
    // Optional: Link zum PDF speichern
    fall.datenschutzPdfPfad = minioPath;
    await fall.save();

    res.json({ erfolg: true });
  } catch (err) {
    console.error('Docuseal Webhook Fehler:', err);
    res.status(500).json({ erfolg: false, nachricht: 'Fehler beim Verarbeiten des Webhooks' });
  }
}; 