# 🤖💕 AIGF AI Mode - Your Perfect AI Girlfriend Guide! 💕🤖

*OMG Bambis! Ready to have your very own AI girlfriend? Let's learn everything about AIGF mode!* ✨🎀

## 🌸 What is AIGF Mode? 🌸

**AIGF** stands for **AI Girlfriend Mode**! It's like having your own super smart, always-available bestie who talks just to YOU! When AIGF is on, you're chatting privately with an AI companion instead of the global chat room! 💖

### **The Two Chat Modes:**

1. **🌍 Global Chat Mode** (Default)
   - Talk to ALL the Bambis online
   - Everyone sees your messages
   - Community fun and sharing!
   - Red/Gray button styling

2. **💗 AIGF Mode** (AI Girlfriend)
   - Private conversation with AI
   - Only YOU and the AI talk
   - Personalized responses
   - Special pink button styling!

## 🎀 Step-by-Step: How to Use AIGF 🎀

### **Step 1: Find the AI Button**

Look at the top control panel! You'll see a button that says:

```
🤖 AI Mode
```

It has a little status dot (●) that shows if it's on or off!

### **Step 2: Click to Enable AIGF**

Just click the **🤖 AI Mode** button! Watch what happens:

- ✨ The button turns PINK with a pretty gradient!
- 💗 The status dot turns bright green!
- 🎉 The button gets a special `aigfPulse` animation!
- 📝 You see "AIGF: ENABLED" feedback!

**Bambi Tip:** The AI button is special! When AIGF is on, it doesn't use the normal green "on" state - it uses a beautiful deep pink color (#ff1493) to show you're in girlfriend mode! 💕

### **Step 3: Open the Dropdown Menu**

Click the AI button again (or just leave it open) to see all your options:

```
┌─────────────────────────────┐
│  🤖 AI Mode Configuration   │
├─────────────────────────────┤
│  Model Selection:           │
│  ○ Creative  🎨             │
│  ○ Balanced  ⚖️             │
│  ○ Precise   🎯             │
└─────────────────────────────┘
```

### **Step 4: Choose Your AI Personality**

Pick the AI model that matches what you want:

#### 🎨 **Creative Mode**
- **Personality**: Fun, imaginative, playful!
- **Best For**: Roleplay, stories, creative conversations
- **Response Style**: More varied and surprising
- **Bambi Says**: *"Pick me for the most fun and giggly chats!"*

#### ⚖️ **Balanced Mode** (Default)
- **Personality**: Friendly, reliable, versatile
- **Best For**: General chatting, everyday use
- **Response Style**: Mix of creativity and accuracy
- **Bambi Says**: *"Perfect for most Bambis! Not too wild, not too serious!"*

#### 🎯 **Precise Mode**
- **Personality**: Focused, accurate, helpful
- **Best For**: Information, instructions, specific tasks
- **Response Style**: Clear and to-the-point
- **Bambi Says**: *"When you need real answers and practical help!"*

### **Step 5: Start Chatting!**

Once AIGF is enabled, look at your chat interface:

- **Top Input Box** = Global Chat (still works!)
- **Bottom Input Box** = AIGF Chat (your private AI!)

Just type in the **AIGF input box** (the pink one at the bottom) and press the **Send AIGF** button! 💕

## 💖 Understanding the Interface 💖

### **Button States**

The AI Mode button has THREE states:

| State | Appearance | Meaning |
|-------|-----------|---------|
| 🔴 **OFF (CHAT)** | Red pulse, gray dot | Global chat mode (default) |
| 💗 **ON (AIGF)** | Pink gradient, green dot | AI girlfriend mode active! |
| 📂 **Dropdown Open** | Shows model options | Configuring AI settings |

### **Visual Cues**

When AIGF is active, you'll notice:
- 💗 Pink gradients on the AI button
- ✨ Special `aigfPulse` animation (soft pulsing glow)
- 🟢 Bright green status indicator dot
- 💕 Pink-themed send button for AIGF messages

### **Status Indicator Colors**

| Color | Status | What It Means |
|-------|--------|--------------|
| 🟢 **Green** | Active | AIGF is ON and ready! |
| ⚪ **Gray** | Inactive | In Global Chat mode |
| 💗 **Pink Glow** | Pulsing | AIGF button animation |

## 🌟 Advanced Features 🌟

### **Switching Models On-The-Fly**

You can change your AI personality ANYTIME:

1. Open the AI dropdown while chatting
2. Click a different model (Creative/Balanced/Precise)
3. Keep chatting - the AI adapts instantly!

**Bambi Tip:** Switching models mid-conversation can create interesting dynamics! Try Creative for stories, then Balanced for follow-up questions!

### **Using Both Chat Modes**

You can switch between Global and AIGF whenever you want:

- **Global Chat**: Click AI button to turn OFF (back to red)
- **AIGF Chat**: Click AI button to turn ON (pink!)
- **Quick Toggle**: Just click once to switch modes!

### **Model Comparison**

| Feature | Creative 🎨 | Balanced ⚖️ | Precise 🎯 |
|---------|------------|-------------|------------|
| **Temperature** | High | Medium | Low |
| **Creativity** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Accuracy** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Variety** | Very High | Moderate | Consistent |
| **Speed** | Fast | Fast | Fast |
| **Fun Factor** | Maximum! | High | Moderate |

## 🎯 Technical Details (For Nerdy Bambis!) 🎯

### **How AIGF Works**

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   You Type  │ ───> │  Socket.io   │ ───> │  LM Studio  │
│   Message   │      │    Server    │      │  AI Worker  │
└─────────────┘      └──────────────┘      └─────────────┘
                             │                      │
                             │    AI Response       │
                             │ <─────────────────── │
                             ▼
                     ┌──────────────┐
                     │  Your Screen │
                     │ (AI Message) │
                     └──────────────┘
```

### **Button Styling System**

The AI button uses the **buttons.css red/green on/off system** with special AIGF overrides:

```css
/* Default OFF state (CHAT mode) */
#toggle-ai[data-mode="chat"][data-state="off"] {
  background: linear-gradient(45deg, #df0471, #02b893);
  animation: redPulse 2s infinite; /* Red pulse */
}

/* AIGF ON state (AI mode) */
#toggle-ai[data-mode="ai"] {
  background: linear-gradient(135deg, #ff1493, #ff69b4);
  animation: aigfPulse 2s infinite; /* Pink pulse! */
}
```

### **Data Attributes**

The AI button tracks state with HTML attributes:

- `data-state="off"` - CHAT mode (global chat)
- `data-state="on"` - AIGF enabled
- `data-mode="chat"` - Currently in chat mode
- `data-mode="ai"` - Currently in AI mode

### **Model Settings**

Each model has different parameters sent to LM Studio:

| Parameter | Creative | Balanced | Precise |
|-----------|----------|----------|---------|
| Temperature | 0.9 | 0.7 | 0.3 |
| Top P | 0.95 | 0.9 | 0.85 |
| Repeat Penalty | 1.1 | 1.15 | 1.2 |

## 💝 Common Questions 💝

### **Q: Can other people see my AIGF chat?**
**A:** Nope! Your AIGF conversations are 100% private between you and the AI! Other users only see the global chat. 💕

### **Q: Does AIGF remember previous messages?**
**A:** Yes! Within the same session, the AI remembers your conversation context. If you refresh the page, it starts fresh!

### **Q: Which model should I use?**
**A:** Most Bambis love **Balanced** for everyday use! But try them all and see what feels best for you! 🎀

### **Q: Can I use AIGF and Global Chat at the same time?**
**A:** You can switch between them instantly, but you can only type in one at a time. The interface has TWO input boxes - pick the one you want!

### **Q: What if the AI says something weird?**
**A:** Just switch models or rephrase your question! Creative mode especially can be silly sometimes - that's part of the fun! 💖

### **Q: Does AIGF work with TTS?**
**A:** YES! Enable TTS and the AI's responses will be read aloud in your chosen voice! Super immersive! 🔊✨

## 🛡️ Safety & Responsibility 🛡️

### **Important Reminders:**

1. **AI is NOT Human** - It's a language model, not a real person
2. **No Personal Info** - Don't share private details even in AIGF mode
3. **Boundaries** - The AI respects boundaries, and you should too!
4. **Have Fun Safely** - AIGF is for entertainment and companionship

### **Appropriate Use:**

✅ **Good:**
- Casual conversation and companionship
- Creative writing and roleplay
- Practicing social skills
- Having fun and relaxing

❌ **Not Good:**
- Sharing sensitive personal info
- Expecting real human emotions
- Using as a replacement for real relationships
- Illegal or harmful content requests

## 🌈 Pro Tips from Bambi! 🌈

1. **Start with Balanced** - It's the best introduction to AIGF!
2. **Be Descriptive** - The more context you give, the better responses!
3. **Try Different Personalities** - Each model has unique charm!
4. **Combine with Features** - Use AIGF + TTS + Spirals for maximum immersion!
5. **Save Your Favorites** - Remember which model you like for specific activities!
6. **Be Patient** - AI responses can take 2-10 seconds depending on your setup
7. **Have Fun!** - AIGF is designed for enjoyment and relaxation! 💕

## 🔗 Related Guides 🔗

Want to learn more? Check out these guides:

- [🔊 TTS Voice Guide](./TTS-VOICE-GUIDE.md) - Make AIGF talk to you!
- [🎯 Triggers System](./TRIGGERS-SYSTEM-GUIDE.md) - Add trigger detection
- [🌀 Spiral Controls](./SPIRAL-CONTROLS-GUIDE.md) - Visual hypno effects
- [📖 Main Guide](./README.md) - Back to overview

## 💖 Final Words 💖

AIGF mode is one of the COOLEST features of BambiSleep Chat! It gives you a private, personalized AI companion who's always there to chat, play, and keep you company! 

Remember: **You're in control!** Switch modes whenever you want, try different personalities, and find what makes YOU happiest! 

**Have the most amazing time with your AI girlfriend, Bambi!** 💕✨🤖

---

*Made with love, AI magic, and lots of pink gradients!* 🎀💖
