import http.server
import socketserver
import os
import json
import time

PORT = 8080
LOG_DIR = 'server_logs'

# Ensure log directory exists
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

class VortexHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/api/logs':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                
                try:
                    data = json.loads(post_data.decode('utf-8'))
                except json.JSONDecodeError:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b'Invalid JSON')
                    return

                # Generate filename
                session_id = data.get('sessionId', f'unknown-{int(time.time())}')
                timestamp = int(time.time())
                filename = f"{LOG_DIR}/log-{session_id}-{timestamp}.txt"
                
                # Save to file
                with open(filename, 'w') as f:
                    for key, value in data.items():
                        f.write(f"{key}: {value}\n")
                
                print(f"📝 Received logs for session {session_id}, saved to {filename}")
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success', 'file': filename}).encode())
                
            except Exception as e:
                print(f"❌ Error handling log upload: {e}")
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode())
        else:
            self.send_error(404, "Not Found")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

import ssl
import qrcode
import socket

# ... imports ...

# ... existing code ...

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # doesn't even have to be reachable
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

def get_ngrok_url():
    import urllib.request
    try:
        req = urllib.request.Request('http://127.0.0.1:4040/api/tunnels')
        with urllib.request.urlopen(req, timeout=2) as response:
            data = json.loads(response.read().decode('utf-8'))
            for tunnel in data.get('tunnels', []):
                if tunnel.get('public_url', '').startswith('https'):
                    return tunnel['public_url']
    except Exception:
        pass
    return None

local_ip = get_local_ip()
ngrok_url = get_ngrok_url()

if ngrok_url:
    url = ngrok_url
else:
    url = f"https://{local_ip}:{PORT}"

print(f"🌀 VortexEye Server running at https://0.0.0.0:{PORT}")
if ngrok_url:
    print(f"🌍 Ngrok Access: {url}")
else:
    print(f"📱 Local Access: {url}")
print(f"📂 Serving {os.getcwd()}")
print(f"📝 Logs will be saved to ./{LOG_DIR}/")

# Generate and display QR code
try:
    qr = qrcode.QRCode()
    qr.add_data(url)
    qr.make(fit=True)
    print("\nScan this QR code to access the app:")
    qr.print_ascii(invert=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    qr_filename = "vortexeye_ngrok_qr.png" if ngrok_url else "vortexeye_qr.png"
    img.save(qr_filename)
    print(f"📸 QR Code also saved to {qr_filename}")
    print("⚠️  SECURITY NOTE: You may see a 'Connection is not private' warning on your phone.")
    print("   Tap 'Advanced' -> 'Proceed' to access the application.")
except Exception as e:
    print(f"⚠️ Could not generate QR code: {e}")

# Create and wrap socket manually
import socket
raw_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
raw_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
raw_socket.bind(('', PORT))
raw_socket.listen(5)

date_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
date_context.load_cert_chain(certfile='cert.pem', keyfile='key.pem')
ssl_socket = date_context.wrap_socket(raw_socket, server_side=True)

print(f"🔒 Socket wrapped: {type(ssl_socket)}")

# Create server with existing socket
httpd = http.server.HTTPServer(("", PORT), VortexHandler, bind_and_activate=False)
httpd.socket = ssl_socket
httpd.server_address = httpd.socket.getsockname()

with httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped.")
