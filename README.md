#  Apple-Style Real-time Team Desk Widget (Mac & Windows)

Microsoft To-Do থেকেও আধুনিক এবং প্রিমিয়াম **Apple SF Pro Glassmorphism UI** ডিজাইনে তৈরি রিয়েল-টাইম টিম টাস্ক, ক্লায়েন্ট ম্যাট্রিক্স ও ক্যালেন্ডার উইজেট।

---

### ✨ মূল ফিচারসমূহ (Key Features)

1. **⚡ আজকের ক্লায়েন্ট ও কাজ (Today's Client Matrix)**:
   - কে কোন ক্লায়েন্টের কাজ করবে (Assigned Client Badges)।
   - প্রতিটি Employee-এর আজকের Active Tasks & Checklist।
   - One-click Mark as Done (Apple Taptic audio chime সহ)।

2. **📋 কার কাজ কি (Full Team Kanban Board)**:
   - To Do, In Progress, Review, Completed কলাম।
   - Priority Tag (Urgent, High, Medium, Low) ও Due Date।
   - Employee ও Client অনুযায়ী ফিল্টার।

3. **🗓️ শিডিউল ও ক্যালেন্ডার (Interactive Master Calendar)**:
   - কার কবে কবে শিডিউল বা মিটিং বা ডেডলাইন আছে।
   - Employee Signature Colors অনুযায়ী ক্যালেন্ডারে রঙিন ইভেন্ট পিল।
   - যে কোনো তারিখে ক্লিক করলেই নতুন শিডিউল যোগ করার সুযোগ।

4. **👥 টিম মেম্বার সেটিংস (Employee Management)**:
   - নতুন Employee যোগ ও রিমুভ করা।
   - Designation, Role, Email এবং Signature Avatar Color সিলেক্ট করা।

5. **🌐 রিয়েল-টাইম মাল্টি-ডিভাইস সিঙ্ক (Real-time Live Sync)**:
   - Mac, Windows PC, ল্যাপটপ বা মোবাইলে এক সাথে লাইভ সিঙ্ক।
   - কোনো রিফ্রেশ ছাড়াই সাথে সাথে সব ডিভাইসে পরিবর্তন দৃশ্যমান হবে (<10ms WebSocket latency)।

6. **🔲 Dual View: Mini Floating Widget Mode vs Full Studio**:
   - স্ক্রিনের এক কোণায় কমপ্যাক্ট উইজেট আকারে রাখার মোড।
   - ফুল স্টুডিও ম্যানেজমেন্ট ভিউ।

7. **🚀 Auto-Run on Login (কম্পিউটার অন করলেই অটো স্টার্ট)**:
   - **macOS**: `./setup-mac-autostart.sh` রান করলেই Mac অন হওয়ার সাথে সাথে ব্যাকগ্রাউন্ডে চালু হবে।
   - **Windows**: `setup-windows-autostart.bat` ডাবল ক্লিক করলেই Windows Startup-এ সেট হয়ে যাবে।

---

### 🚀 ব্যবহারের নিয়ম (How to Run & Connect)

#### ১. আপনার মূল পিসিতে (Localhost):
ব্রাউজারে ওপেন করুন:
👉 **[http://localhost:4173](http://localhost:4173)**

#### ২. অফিসের অন্যান্য Mac / Windows পিসি থেকে যুক্ত করতে:
যে কোনো ডিভাইসের ব্রাউজারে প্রবেশ করুন:
👉 **http://192.168.0.24:4173** *(অথবা অ্যাপের সিঙ্ক সেটিংসে দেওয়া আপনার লোকাল IP)*

---

### 📂 ফাইল স্ট্রাকচার
- `server.js` : Node.js Express + WebSocket রিয়েল-টাইম ডিসপ্যাচার ও স্টোর
- `public/index.html` : Apple Glassmorphism ফ্রন্টএন্ড লেআউট
- `public/styles.css` : Cupertino Design System, Dark/Light Themes
- `public/app.js` : রিয়েল-টাইম ক্লায়েন্ট স্টেট ও ইন্টারঅ্যাক্টিভ ক্যালেন্ডার
- `public/sounds.js` : Web Audio API সাউন্ড ইফেক্টস
- `setup-mac-autostart.sh` : Mac Auto-boot কনফিগারেশন স্ক্রিপ্ট
- `setup-windows-autostart.bat` : Windows Auto-boot কনফিগারেশন স্ক্রিপ্ট
- `data/store.json` : অটোমেটিক পারসিস্টেন্ট ডেটাবেজ ফাইল
