// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyA4f-T_VOfisiaa6Xw7WisXVtZkvnHgMJA",
  authDomain: "quak-chat.firebaseapp.com",
  databaseURL: "https://quak-chat-default-rtdb.firebaseio.com",
  projectId: "quak-chat",
  storageBucket: "quak-chat.firebasestorage.app",
  messagingSenderId: "790684002191",
  appId: "1:790684002191:web:705644a633ed7772708dfa",
  measurementId: "G-YH47TR1Z1S"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let myUserId = localStorage.getItem('chat_user_id') || 'user_' + Math.random().toString(36).substring(2, 10);
localStorage.setItem('chat_user_id', myUserId);

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
if (!roomId && window.location.pathname.includes('chat.html')) window.location.href = 'index.html';

const chatMessages = document.getElementById('chatMessages');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const userStatus = document.getElementById('userStatus');
const statusIndicator = document.getElementById('statusIndicator');
const shareBanner = document.getElementById('shareBanner');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const voiceBtn = document.getElementById('voiceBtn');
const replyBar = document.getElementById('replyBar');
const replyText = document.getElementById('replyText');
const cancelReplyBtn = document.getElementById('cancelReplyBtn');
const autoDeleteBtn = document.getElementById('autoDeleteBtn');
const pinnedBar = document.getElementById('pinnedBar');
const pinnedText = document.getElementById('pinnedText');
const unpinBtn = document.getElementById('unpinBtn');

let activeReplyMsg = null;
let mediaRecorder, audioChunks = [];
let isAutoDeleteOn = false;

// Dark Theme Toggle
themeToggleBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark-theme');
  const isDark = document.body.classList.contains('dark-theme');
  themeToggleBtn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
});

// Auto Delete 15 Mins Toggle
autoDeleteBtn.addEventListener('click', () => {
  isAutoDeleteOn = !isAutoDeleteOn;
  autoDeleteBtn.style.color = isAutoDeleteOn ? '#25d366' : 'white';
  alert(isAutoDeleteOn ? "15 મિનિટ પછી ગાયબ થતા મેસેજ ચાલુ થયા!" : "ગાયબ થતા મેસેજ બંધ થયા.");
});

if (roomId) initChatRoom();

function initChatRoom() {
  const messagesRef = database.ref(`rooms/${roomId}/messages`);
  const pinnedRef = database.ref(`rooms/${roomId}/pinned`);

  // Pinned message listener
  pinnedRef.on('value', snap => {
    const val = snap.val();
    if (val) {
      pinnedText.innerText = val.text;
      pinnedBar.classList.remove('hidden');
    } else {
      pinnedBar.classList.add('hidden');
    }
  });

  unpinBtn.addEventListener('click', () => pinnedRef.remove());

  // Messages Listener
  messagesRef.on('value', snapshot => {
    chatMessages.innerHTML = `<div class="system-message"><i class="fa-solid fa-shield-halved"></i> <span>આ ચેટ સુરક્ષિત છે.</span></div>`;
    const msgs = snapshot.val();
    const now = Date.now();

    if (msgs) {
      Object.keys(msgs).forEach(key => {
        const msg = msgs[key];

        // Self-Destruct Logic (15 Mins = 900000 ms)
        if (msg.autoDelete && (now - msg.timestamp > 15 * 60 * 1000)) {
          messagesRef.child(key).remove();
          return;
        }

        const isOwn = msg.senderId === myUserId;
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${isOwn ? 'outgoing' : 'incoming'}`;

        // Reply Quote inside Bubble
        if (msg.replyTo) {
          const qDiv = document.createElement('div');
          qDiv.className = 'reply-quote';
          qDiv.innerText = msg.replyTo;
          bubble.appendChild(qDiv);
        }

        // Voice Note, Media or Text
        if (msg.type === 'voice') {
          const audio = document.createElement('audio');
          audio.src = msg.media;
          audio.controls = true;
          bubble.appendChild(audio);
        } else if (msg.type === 'image' || msg.image) {
          const img = document.createElement('img');
          img.src = msg.media || msg.image;
          img.style.maxWidth = '100%';
          bubble.appendChild(img);
        } else if (msg.text) {
          const span = document.createElement('span');
          span.innerText = msg.text;
          bubble.appendChild(span);
        }

        // Reactions
        if (msg.reaction) {
          const rBox = document.createElement('div');
          rBox.className = 'reaction-box';
          rBox.innerText = msg.reaction;
          bubble.appendChild(rBox);
        }

        // Double Tap / Click for Action (Reply / Reaction / Pin)
        bubble.addEventListener('dblclick', () => {
          const choice = prompt("1: પિન કરો | 2: રિપ્લાય | 3: 👍 | 4: ❤️");
          if (choice === '1') pinnedRef.set({ text: msg.text || "મીડિયા મેસેજ" });
          else if (choice === '2') {
            activeReplyMsg = msg.text || "મીડિયા";
            replyText.innerText = activeReplyMsg;
            replyBar.classList.remove('hidden');
          } else if (choice === '3') messagesRef.child(`${key}/reaction`).set('👍');
          else if (choice === '4') messagesRef.child(`${key}/reaction`).set('❤️');
        });

        chatMessages.appendChild(bubble);
      });
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  });
}

// Cancel Reply
cancelReplyBtn.addEventListener('click', () => {
  activeReplyMsg = null;
  replyBar.classList.add('hidden');
});

// Send Text Message
messageForm.addEventListener('submit', e => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (text && roomId) {
    database.ref(`rooms/${roomId}/messages`).push({
      senderId: myUserId,
      text: text,
      timestamp: Date.now(),
      replyTo: activeReplyMsg,
      autoDelete: isAutoDeleteOn
    });
    messageInput.value = '';
    activeReplyMsg = null;
    replyBar.classList.add('hidden');
  }
});

// Voice Note Recording Logic
voiceBtn.addEventListener('click', async () => {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
      const reader = new FileReader();
      reader.onloadend = () => {
        database.ref(`rooms/${roomId}/messages`).push({
          senderId: myUserId,
          type: 'voice',
          media: reader.result,
          timestamp: Date.now(),
          autoDelete: isAutoDeleteOn
        });
      };
      reader.readAsDataURL(audioBlob);
    };

    mediaRecorder.start();
    voiceBtn.classList.add('recording');
  } else {
    mediaRecorder.stop();
    voiceBtn.classList.remove('recording');
  }
});
