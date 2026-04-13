# Siva Lathe Works - Business Management System

A modern business management application for Siva Lathe Works (Tiruppur). Built with vanilla JavaScript and organized as a professional web project with proper build tooling.

## 📋 Project Overview

This is an internal business management system for tracking:
- **Jobs**: Create and manage work orders
- **Payments**: Record and track customer payments
- **Customers**: Manage customer information and balance tracking
- **Reports**: Generate job and payment reports
- **Dashboard**: Real-time overview of pending jobs and balances
- **Work Types**: Define and manage work types and rates

## 🏗️ Project Structure

```
SLW/
├── src/                    # Source files
│   ├── index.html         # Main HTML entry point
│   ├── js/                # JavaScript modules
│   │   ├── index.js       # Main bundled file (compiled from script.js)
│   │   ├── app.js         # App initialization
│   │   ├── jobs.js        # Job management module
│   │   ├── payments.js    # Payment management module
│   │   ├── dashboard.js   # Dashboard module
│   │   ├── data.js        # Data management and localStorage
│   │   ├── utils.js       # Utility functions
│   │   └── *.js           # Other feature modules
│   └── css/               # Stylesheets
│       ├── styles.css     # Main styles
│       ├── components.css # Component styles
│       ├── layout.css     # Layout styles
│       ├── forms.css      # Form styles
│       ├── responsive.css # Responsive styles
│       └── variables.css  # CSS variables
├── public/                # Static assets
├── dist/                  # Build output (auto-generated)
├── scripts/               # Build scripts
├── package.json           # Project metadata and scripts
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ and npm

### Installation

1. **Navigate to project directory**
   ```bash
   cd SLW
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   - Navigate to `http://localhost:8080` (or open `dist/index.html` directly)

### Build for Production

```bash
npm run build
```

This will:
- Copy HTML and CSS to `dist/`
- Bundle and minify JavaScript to `dist/app.js`
- Generate optimized production code

## 📦 Available Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start development with file watching |
| `npm run build` | Create production build |
| `npm run copy-assets` | Copy static assets to dist |
| `npm run preview` | Preview production build locally |

## 🎨 Theme Support

The application supports light and dark themes:
- Automatically detects system preference
- User can toggle theme (saved to localStorage)
- Themes defined in `css/variables.css`

## 📝 Features

### Implemented
- ✅ Job management with custom work types and rates
- ✅ Payment recording and tracking
- ✅ Customer database with balance tracking
- ✅ Real-time dashboard with pending jobs and amounts
- ✅ Job and payment history
- ✅ Comprehensive reports
- ✅ Dark/Light theme support
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ LocalStorage data persistence
- ✅ Modal-based forms

## 🔧 Technology Stack

- **Language**: Vanilla JavaScript (ES6+)
- **Styling**: CSS3 with CSS variables
- **Build Tool**: esbuild
- **Version Control**: Git
- **Runtime**: Browser-based (no backend)
- **Data Storage**: Browser localStorage

## 📱 Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Modern mobile browsers

## 🛠️ Development Workflow

1. **Make changes** in `src/` directory
2. **Run `npm run dev`** for live development
3. **Changes rebuild automatically** (watch mode)
4. **Check `dist/`** folder for compiled output
5. **Test in browser** at `http://localhost:8080`

## 📄 Code Organization

- **Modules**: Each feature has its own JS file
- **CSS**: Organized by concern (components, layout, forms, etc.)
- **Data**: Centralized in `js/data.js` with localStorage integration
- **Utils**: Common functions in `js/utils.js`

## ⚙️ Configuration

### CSS Variables
Edit `src/css/variables.css` to customize:
- Colors (light/dark themes)
- Spacing and sizing
- Font families
- Border radius values

### Build Options
Modify `package.json` scripts to change build behavior

## 🔐 Data Privacy

All data is stored locally in the browser (localStorage):
- No server communication
- No cloud storage
- Data persists across sessions
- Data can be cleared via browser storage settings

## 🤝 Contributing

For internal team use only. Keep code:
- Well-commented for clarity
- Organized by feature
- Tested before committing
- Documented changes in commit messages

## 📞 Support

For issues or questions, contact the development team.

## 📄 License

UNLICENSED - For internal company use only

---

**Last Updated**: April 2026  
**Version**: 1.0.0
