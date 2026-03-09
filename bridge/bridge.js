const http = require('http');
const { WebSocket, WebSocketServer } = require('ws');

const PORT = 8080;

/**
 * BRIDGE FINGERPRINT WINNY-POS
 * Menghubungkan browser ke hardware Fingerprint USB.
 * Protocol: DPBiotek (Local SDK Bridge)
 */

// HTTP Server for Status Check
const server = http.createServer((req, res) => {
    // Enable CORS agar bisa diakses dari web browser localhost (Vite)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.url === '/DPBiotek/Fingerprint/Status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'READY',
            service: 'Winny Fingerprint Bridge',
            version: '1.0.0',
            deviceConnected: true
        }));
    } else {
        res.writeHead(404);
        res.end();
    }
});

// WebSocket Server
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url, `http://${request.headers.host}`);

    if (pathname === '/DPBiotek/FingerprintSocket') {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
});

wss.on('connection', (ws) => {
    console.log('[\u2713] Browser Connected');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('[\u2192] Command Received:', data.command, data.mode || '');

            if (data.command === 'START_CAPTURE') {
                console.log('[\u23F3] Waiting for finger on scanner...');

                // SIMULASI: Dalam 3 detik kirim response sukses
                // Catatan: Untuk implementasi hardware asli, di sini panggil SDK C++/Java
                setTimeout(() => {
                    const template = 'TPL' + Math.random().toString(36).substring(2).toUpperCase();

                    if (data.mode === 'ENROLL') {
                        ws.send(JSON.stringify({
                            status: 'ENROLLED',
                            template_base64: template,
                            message: 'Sidik jari berhasil didaftarkan'
                        }));
                        console.log('[\u2713] Enrollment Success:', template);
                    } else {
                        ws.send(JSON.stringify({
                            status: 'CAPTURED',
                            template_base64: template,
                            message: 'Sidik jari terdeteksi'
                        }));
                        console.log('[\u2713] Capture Success:', template);
                    }
                }, 2500);

            } else if (data.command === 'STOP_CAPTURE') {
                console.log('[\u2716] Capture Stopped');
            }
        } catch (e) {
            console.error('[!] Error processing message:', e.message);
        }
    });

    ws.on('close', () => {
        console.log('[\u2716] Browser Disconnected');
    });
});

server.listen(PORT, () => {
    console.log('=========================================');
    console.log('   WINNY FINGERPRINT BRIDGE RUNNING      ');
    console.log('=========================================');
    console.log(`Port    : ${PORT}`);
    console.log(`Status  : http://localhost:${PORT}/DPBiotek/Fingerprint/Status`);
    console.log(`Socket  : ws://localhost:${PORT}/DPBiotek/FingerprintSocket`);
    console.log('-----------------------------------------');
    console.log('Tekan Ctrl+C untuk menghentikan bridge.');
});
