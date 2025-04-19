// Cấu hình Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBWa0utLTN3oEkENPxwui87_HQsw9VKiSM",
    authDomain: "ai-timini.firebaseapp.com",
    projectId: "ai-timini",
    storageBucket: "ai-timini.appspot.com",
    messagingSenderId: "253638969082",
    appId: "1:253638969082:web:88588b14dd6629e52bab43"
};

// Biến toàn cục
let firebaseInitialized = false;
let database;
let firebaseRef;
let websocket = null;
const deviceIP = "192.168.1.7"; // Địa chỉ IP cố định của thiết bị
const config = { port: 81 };

// Khởi tạo Firebase
function initializeFirebase() {
    try {
        firebase.initializeApp(firebaseConfig);
        database = firebase.database();
        firebaseRef = database.ref('devices/led1');
        firebaseInitialized = true;
        console.log("Firebase initialized successfully");
        
        // Xác thực ẩn danh
        firebase.auth().signInAnonymously()
            .then(() => console.log("Đã đăng nhập Firebase thành công"))
            .catch(error => console.error("Lỗi đăng nhập Firebase:", error));
            
    } catch (error) {
        console.error("Firebase initialization error:", error);
        firebaseInitialized = false;
    }
}

// Hiển thị trạng thái kết nối
function showConnectingStatus() {
    const statusElement = document.getElementById('connection-status');
    if (!statusElement) return;
    
    statusElement.innerHTML = `
        <div class="loading-dots">
            <span></span><span></span><span></span>
        </div>
        Đang kết nối với thiết bị...
    `;
    statusElement.className = 'connection-status';
}

// Hàm gửi lệnh qua Firebase
function sendFirebaseCommand(command) {
    if (!firebaseInitialized) {
        console.warn("Firebase chưa được khởi tạo");
        return;
    }
    
    firebaseRef.update({
        command: command,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    }).catch(error => {
        console.error("Lỗi gửi lệnh Firebase:", error);
        addBotMessage("Lỗi khi gửi lệnh đến Firebase");
    });
}

// Kết nối WebSocket
function connectWebSocket() {
    showConnectingStatus();
    
    // Đóng kết nối cũ nếu tồn tại
    if (websocket) {
        websocket.onclose = null;
        websocket.onerror = null;
        websocket.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const socketUrl = `${protocol}${deviceIP}:${config.port}`;

    console.log(`Đang kết nối đến: ${socketUrl}`);
    websocket = new WebSocket(socketUrl);

    // Thiết lập timeout kết nối
    const connectionTimeout = setTimeout(() => {
        if (websocket.readyState !== WebSocket.OPEN) {
            console.log('Kết nối timeout');
            websocket.close();
            updateConnectionStatus(false);
            addBotMessage("Không thể kết nối với thiết bị. Vui lòng thử lại sau.");
        }
    }, 5000);

    websocket.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('✅ Kết nối WebSocket thành công');
        updateConnectionStatus(true);
        enableControls(true);
        addBotMessage("Đã kết nối với thiết bị Timini");
        sendWebSocketMessage({ type: 'get_status' });
    };

    websocket.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('Lỗi WebSocket:', error);
        updateConnectionStatus(false);
        addBotMessage("Lỗi kết nối với thiết bị");
    };

    websocket.onclose = () => {
        clearTimeout(connectionTimeout);
        console.log('❌ Mất kết nối');
        updateConnectionStatus(false);
        enableControls(false);
        setTimeout(connectWebSocket, 5000);
    };

    websocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('Nhận dữ liệu:', data);

            if (data.type === 'ai_response') {
                addBotMessage(data.message);
            } else if (data.type === 'led_status') {
                updateLEDState(data.value);
            }
        } catch (error) {
            console.error('Lỗi phân tích tin nhắn:', error);
        }
    };
}

function sendWebSocketMessage(message) {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify(message));
    } else {
        console.warn('Chưa kết nối WebSocket');
        addBotMessage("Mất kết nối với thiết bị. Đang thử kết nối lại...");
        connectWebSocket();
    }
}

function enableControls(enabled) {
    ['btn-on', 'btn-off', 'user-input', 'send-btn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !enabled;
    });
}

function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connection-status');
    if (!statusElement) return;

    if (connected) {
        statusElement.textContent = `✅ Đã kết nối với thiết bị`;
        statusElement.className = 'connection-status connected';
    } else {
        statusElement.innerHTML = `
            <div class="loading-dots">
                <span></span><span></span><span></span>
            </div>
            Đang thử kết nối lại...
        `;
        statusElement.className = 'connection-status';
    }
}

function addUserMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const msg = document.createElement('div');
    msg.className = 'message user-message';
    msg.textContent = message;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addBotMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const msg = document.createElement('div');
    msg.className = 'message bot-message';
    msg.textContent = message;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateLEDState(state) {
    const ledIndicator = document.getElementById('led-indicator');
    const ledText = document.getElementById('led-text');
    
    if (ledIndicator) ledIndicator.classList.toggle('on', state);
    if (ledText) ledText.textContent = state ? 'Đèn đang BẬT' : 'Đèn đang TẮT';
}

function sendChatMessage() {
    const input = document.getElementById('user-input');
    if (!input) return;
    
    const message = input.value.trim();
    if (!message) return;
    
    addUserMessage(message);
    sendWebSocketMessage({ type: 'ai_chat', message });
    input.value = '';
}

// Khởi động ứng dụng
document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
    connectWebSocket();

    // Thiết lập sự kiện
    document.getElementById('btn-on')?.addEventListener('click', () => {
        sendWebSocketMessage({ type: 'led_control', command: 'on' });
        sendFirebaseCommand('on');
        addUserMessage('bật đèn');
    });

    document.getElementById('btn-off')?.addEventListener('click', () => {
        sendWebSocketMessage({ type: 'led_control', command: 'off' });
        sendFirebaseCommand('off');
        addUserMessage('tắt đèn');
    });

    document.getElementById('send-btn')?.addEventListener('click', sendChatMessage);
    document.getElementById('user-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
});