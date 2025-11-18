/* =============================================================
   Chai Junction — Frontend Gemini Chatbot (Final Version)
   ============================================================ */

// Replaced previous API key/model setup with robust fetch logic for grounding
const GEMINI_API_KEY = "AIzaSyAXKzFh7VyPN_ck56sj2G2eOReBbcfXSL0"; // Left empty for Canvas environment to provide
const API_URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent";

const systemInstruction = `
You are the Chai Junction Assistant.
Your replies must be short, professional and polite (1–2 sentences).
If you use grounding (Google Search), be sure to integrate the information naturally.

Shop Details:
- Address: Shop No. 15, MG Road, Barshi
- Hours: 7 AM – 11 PM daily
- Contact: +91 98765 43210
- Items: Masala Chai, Kulhad Chai, Bun Maska, Maggi, Veg Sandwich

If question is unrelated → respond politely and redirect to food/shop topics.
`;

let container, toggleBtn, messages, userInput, sendBtn;

// --- Utility Functions for API Communication ---

/**
 * Parses the API response to extract text and grounding sources.
 * @param {object} result The JSON response object from the API.
 * @returns {{text: string, sources: Array<{uri: string, title: string}>}}
 */
function parseResponse(result) {
    let text = "Sorry, I couldn't generate a response.";
    let sources = [];

    const candidate = result.candidates?.[0];

    if (candidate && candidate.content?.parts?.[0]?.text) {
        text = candidate.content.parts[0].text;

        const groundingMetadata = candidate.groundingMetadata;
        if (groundingMetadata && groundingMetadata.groundingAttributions) {
            sources = groundingMetadata.groundingAttributions
                .map(attribution => ({
                    uri: attribution.web?.uri,
                    title: attribution.web?.title,
                }))
                .filter(source => source.uri && source.title);
        }
    }
    return { text, sources };
}

/**
 * Makes an API call with exponential backoff for retries.
 */
async function fetchWithRetry(payload, maxRetries = 5, delay = 1000) {
    const url = `${API_URL_BASE}?key=${GEMINI_API_KEY}`;
    let lastError = null;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(`HTTP error! Status: ${response.status}. Details: ${JSON.stringify(errorBody)}`);
            }

            return response.json();

        } catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
            }
        }
    }
    console.error("Failed to fetch after multiple retries:", lastError);
    throw new Error("Failed to connect to the AI service.");
}

// --- Chat UI Functions ---

// Add message to chat, now accepts optional sources
function appendMessage(type, text, sources = []) {
    const div = document.createElement("div");
    div.className = `message ${type === "user" ? "user-message" : "bot-message"}`;

    const textNode = document.createTextNode(text);
    div.appendChild(textNode);

    // Add sources if present (only for bot responses)
    if (type === "bot" && sources.length > 0) {
        const sourceContainer = document.createElement('div');
        sourceContainer.className = 'source-container';

        const sourceTitle = document.createElement('p');
        sourceTitle.className = 'source-title';
        sourceTitle.textContent = 'Sources:';
        sourceContainer.appendChild(sourceTitle);

        // Limit to 3 sources for clean display
        sources.slice(0, 3).forEach((source, index) => {
            const link = document.createElement('a');
            link.href = source.uri;
            link.target = '_blank';
            link.className = 'source-link';
            link.textContent = `${index + 1}. ${source.title}`;
            sourceContainer.appendChild(link);
        });
        div.appendChild(sourceContainer);
    }

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function typingBubble() {
    const div = document.createElement("div");
    div.className = "message bot-message typing-indicator";
    div.innerText = "🫖 Preparing your reply...";
    return div;
}

// --- Main AI Logic ---

async function askGeminiWithGrounding(message) {
    const payload = {
        contents: [{ parts: [{ text: message }] }],
        // Enable Google Search grounding
        tools: [{ "google_search": {} }],
        // Use the existing persona/shop details
        systemInstruction: {
            parts: [{ text: systemInstruction }]
        },
    };

    try {
        const result = await fetchWithRetry(payload);
        return parseResponse(result); // Returns {text, sources}
    } catch (err) {
        console.error("Error asking Gemini:", err);
        return { text: "⚠️ Unable to connect to the AI service. Please check your network or try again later.", sources: [] };
    }
}

let sending = false;

async function handleSend() {
    const text = userInput.value.trim();
    if (!text || sending) return;

    sending = true;

    // 1. Display user message and clear input
    appendMessage("user", text);
    userInput.value = "";
    userInput.disabled = true;
    sendBtn.disabled = true;

    // 2. Show loading indicator
    const loader = typingBubble();
    messages.appendChild(loader);

    // 3. Get reply with grounding
    const { text: reply, sources } = await askGeminiWithGrounding(text);

    // 4. Remove loader and display bot message
    loader.remove();
    appendMessage("bot", reply, sources);

    // 5. Cleanup
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();

    sending = false;
}

// --- Event Listeners and Init ---

function openOrder() {
  document.getElementById('order-modal').classList.add('open');
}

function closeOrder() {
  document.getElementById('order-modal').classList.remove('open');
}

// Init after DOM loaded
document.addEventListener("DOMContentLoaded", () => {
    container = document.getElementById("chatbot-container");
    toggleBtn = document.getElementById("chatbot-toggle");
    messages = document.getElementById("chatbot-messages");
    userInput = document.getElementById("user-input");
    sendBtn = document.getElementById("send-btn");

    // Mobile hamburger menu
    const hamburger = document.getElementById("hamburger-menu");
    const navMenu = document.getElementById("nav-menu");
    
    if(hamburger && navMenu) {
        hamburger.addEventListener("click", () => {
            hamburger.classList.toggle("active");
            navMenu.classList.toggle("active");
        });

        // Close menu when clicking on a link
        navMenu.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", () => {
                hamburger.classList.remove("active");
                navMenu.classList.remove("active");
            });
        });

        // Close menu when clicking outside
        document.addEventListener("click", (e) => {
            if (!hamburger.contains(e.target) && !navMenu.contains(e.target)) {
                hamburger.classList.remove("active");
                navMenu.classList.remove("active");
            }
        });
    }

    // Chatbot visibility toggle
    toggleBtn.addEventListener("click", () => {
        container.classList.toggle("open");
        messages.scrollTop = messages.scrollHeight;
        if(container.classList.contains("open")) {
            userInput.focus();
        }
    });

    // Close button functionality
    const closeBtn = document.getElementById("close-chatbot");
    if(closeBtn) {
        closeBtn.addEventListener("click", () => {
            container.classList.remove("open");
        });
    }

    // Handle send on button click
    sendBtn.addEventListener("click", handleSend);

    // Handle send on Enter key press
    userInput.addEventListener("keypress", (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent new line in input
            handleSend();
        }
    });

    // Handle 'Order Ahead' button click
    const orderBtn = document.getElementById('order-btn');
    if(orderBtn) {
        orderBtn.addEventListener('click', openOrder);
    }

    // Handle 'Clear Chat' button click
    const clearChat = document.getElementById("clear-chat");
    if(clearChat) {
        clearChat.addEventListener("click", () => {
            messages.innerHTML = `
              <div class="message bot-message">Chat cleared. How can I help you? ☕</div>
            `;
        });
    }

    // FAQ Accordion functionality
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            // Close all other items
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
            // Toggle current item
            item.classList.toggle('active');
        });
    });
});
