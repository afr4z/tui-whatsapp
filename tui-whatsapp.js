const { Client, LocalAuth } = require("whatsapp-web.js");
const blessed = require("blessed");
const qrcode = require("qrcode-terminal");
const emoji = require("node-emoji"); // For handling emojis

let chats = [];
let currentChat = null;
let client = null;

// Setup Blessed screen
const screen = blessed.screen({
  smartCSR: true,
  title: "WhatsApp TUI",
});

// Chat list box (left)
const chatListBox = blessed.list({
  top: 0,
  left: 0,
  width: "30%",
  height: "100%",
  label: "Chats",
  border: { type: "line" },
  keys: true,
  vi: true,
  items: [],
  style: {
    selected: { bg: "green" },
    item: { hover: { bg: "blue" } },
  },
});

// Chat window box (right)
const chatWindow = blessed.box({
  top: 0,
  left: "30%",
  width: "70%",
  height: "90%",
  label: "Messages",
  border: { type: "line" },
  scrollable: true,
  alwaysScroll: true,
  scrollbar: { ch: " ", inverse: true },
});

// Message input box
const inputBox = blessed.textbox({
  bottom: 0,
  left: "30%",
  width: "70%",
  height: 3,
  border: { type: "line" },
  inputOnFocus: true,
});

// WhatsApp client setup
client = new Client({
  authStrategy: new LocalAuth(),
});

// Show QR code for login
client.on("qr", (qr) => {
  // Create a QR code box and render
  const qrBox = blessed.box({
    top: "center",
    left: "center",
    width: "shrink",
    height: "shrink",
    content: "Scan the QR code to log in!",
    border: { type: "line" },
    style: { border: { fg: "green" } },
  });

  screen.append(qrBox);
  screen.render();

  // Display the QR code
  qrcode.generate(qr, { small: true }, (qrCode) => {
    qrBox.setContent(`${qrBox.getContent()}\n${qrCode}`);
    screen.render();
  });
});

// After successful login, initialize the UI
client.on("ready", async () => {
  // Remove the QR code box
  screen.children.forEach((child) => screen.remove(child));

  // Append chat list and input fields now
  screen.append(chatListBox);
  screen.append(chatWindow);
  screen.append(inputBox);

  // Load and display the chat list
  updateChatList();

  // Default to selecting the first chat and loading messages
  chatListBox.select(0);
  loadChatWindow(chats[0]);

  // Focus on chat list for navigation initially
  chatListBox.focus();
  screen.render();
});

// Receive new message
client.on("message", async (message) => {
  if (currentChat && message.from === currentChat.id._serialized) {
    chatWindow.setContent(
      `${chatWindow.getContent()}\n${senderName}:${handleEmojis(message.body)}`,
    );
  }
  screen.render();
});

// Handle Emojis
function handleEmojis(text) {
  return emoji.emojify(text); // Converts `:smile:` to the actual smiley emoji
}

// Update chat list from WhatsApp
async function updateChatList() {
  chats = await client.getChats();
  chatListBox.clearItems();
  chats.forEach((chat) => {
    chatListBox.addItem(handleEmojis(chat.name || chat.id.user)); // Display name or number
  });
  screen.render();
  if (chats.length > 0) {
    chatListBox.select(0); // Select the first chat
    loadChatWindow(chats[0]); // Load the first chat window
  }
}

// Start new chat message submission
inputBox.on("submit", (msg) => {
  if (currentChat) {
    client
      .sendMessage(currentChat.id._serialized, handleEmojis(msg))
      .then(() => {
        chatWindow.setContent(
          `${chatWindow.getContent()}\nYou: ${handleEmojis(msg)}`,
        );
        screen.render();
      });
  }
  inputBox.clearValue();
  screen.render();
});

// Select chat from list
chatListBox.on("select", (item, index) => {
  currentChat = chats[index];
  loadChatWindow(currentChat);
  inputBox.focus(); // Move focus to input after selecting a chat
});

// Load chat messages into the chat window
async function loadChatWindow(chat) {
  chatWindow.setContent(""); // Clear previous messages
  try {
    const messages = await chat.fetchMessages({ limit: 20 }); // Fetch recent 20 messages
    messages.forEach((message) => {
      let senderName;

      // Check if the message is from you
      if (message.fromMe) {
        senderName = "You";
      } else if (message.from) {
        senderName = chat.name || chat.user || "Unknown";
      }

      chatWindow.setContent(
        `${chatWindow.getContent()}\n${senderName}: ${handleEmojis(message.body)}`,
      );
    });
  } catch (error) {
    chatWindow.setContent("Error: Failed to load chat messages.");
  }

  screen.render();
}
// Switch between chat list and input box using the Tab key
screen.key("tab", () => {
  if (screen.focused === chatListBox) {
    inputBox.focus(); // Focus on the input box when Tab is pressed
  } else {
    chatListBox.focus(); // Focus back on the chat list
  }
  screen.render();
});

// Initialize WhatsApp client
client.initialize();

// Quit the application
screen.key(["q", "C-c"], () => process.exit(0));
