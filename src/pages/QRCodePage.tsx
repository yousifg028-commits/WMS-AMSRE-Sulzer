import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { Printer, QrCode, Copy, CheckCheck } from 'lucide-react';
import { useState, useRef } from 'react';

export default function QRCodePage() {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLCanvasElement>(null);
  const baseUrl = window.location.origin;
  const formUrl = `${baseUrl}/request-stock`;

  const handleCopy = () => {
    navigator.clipboard.writeText(formUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const canvas = qrRef.current;
    if (!canvas) return;
    const qrDataUrl = canvas.toDataURL('image/png');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>WMS Stock Out QR Code</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
            h1 { font-size: 24px; margin-bottom: 8px; }
            h2 { font-size: 16px; color: #666; margin-bottom: 30px; font-weight: normal; }
            .qr { margin: 20px auto; }
            p { font-size: 14px; color: #999; margin-top: 20px; }
            .instructions { text-align: left; max-width: 400px; margin: 20px auto; font-size: 13px; color: #555; }
            .instructions li { margin-bottom: 6px; }
          </style>
        </head>
        <body>
          <h1>AMSER - Sulzer</h1>
          <h2>Stock Out Request</h2>
          <div class="qr">
            <img src="${qrDataUrl}" width="250" height="250" />
          </div>
          <p>Scan this QR code to request stock out</p>
          <div class="instructions">
            <strong>Instructions:</strong>
            <ol>
              <li>Open your phone camera</li>
              <li>Point at the QR code</li>
              <li>Tap the link that appears</li>
              <li>Select your name and item</li>
              <li>Enter quantity and submit</li>
            </ol>
          </div>
          <p>${formUrl}</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="p-6">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <QrCode className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Stock Out QR Code</h1>
          <p className="text-gray-500 mb-6">Employees can scan this code to request stock out items</p>

          <div className="bg-gray-50 rounded-xl p-6 mb-6 inline-block">
            <QRCodeSVG
              value={formUrl}
              size={250}
              level="H"
              includeMargin={true}
              bgColor="#ffffff"
              fgColor="#1e40af"
            />
          </div>
          <div style={{ position: 'absolute', left: '-9999px' }}>
            <QRCodeCanvas ref={qrRef} value={formUrl} size={250} level="H" includeMargin={true} />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-700 font-medium mb-1">Form Link:</p>
            <p className="text-xs text-blue-600 break-all">{formUrl}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              <Printer className="w-5 h-5" />
              Print QR Code
            </button>
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              {copied ? <CheckCheck className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mt-4">
          <h3 className="font-semibold text-gray-900 mb-3">How it works:</h3>
          <ol className="text-sm text-gray-600 space-y-2">
            <li className="flex items-start gap-2">
              <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
              Print this QR code and place it in the warehouse
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
              Employee scans the QR code with their phone camera
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
              Selects their name and the item needed
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
              Submits the request — it goes directly to the warehouse system
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
