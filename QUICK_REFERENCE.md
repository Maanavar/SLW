# Project Quick Reference Card

## 📂 Where to Find Files

### 🔴 RED - Where Work Happens
```
src/                    ← Edit source files here
├── js/                 ← JavaScript modules
├── css/                ← Stylesheets
└── index.html          ← HTML entry point
```

### 🟢 GREEN - Where Build Output Goes
```
dist/                   ← Production build (DO NOT EDIT)
├── app.js              ← Bundled JavaScript (81KB)
├── index.html          ← Copied from src/
└── css/                ← Copied from src/
```

### 🟡 YELLOW - Configuration
```
.eslintrc.cjs           ← Code quality rules
.prettierrc.json        ← Formatting rules
jest.config.js          ← Test configuration
tsconfig.json           ← TypeScript configuration
package.json            ← Project metadata & scripts
```

### 🔵 BLUE - CI/CD & Documentation
```
.github/workflows/ci.yml     ← Automated pipeline
README.md, *.md             ← Documentation
```

---

## 🚀 Common Commands

### Development
```bash
npm run dev              # Start developing (watch mode)
npm run preview          # Preview production build
```

### Build & Deploy
```bash
npm run build            # Production build (with tests)
npm run build:fast       # Quick build (skip checks)
```

### Quality Assurance
```bash
npm run validate         # Run ALL checks
npm run lint:check       # Check code style
npm run format:check     # Check formatting
npm run test             # Run tests
npm run type-check       # Check TypeScript types
```

### Fixing Issues
```bash
npm run lint             # Auto-fix linting issues
npm run format           # Auto-format code
```

---

## 📊 File Count

| Component | Count | Status |
|-----------|-------|--------|
| Source files | 21 | ✅ Ready |
| Build outputs | 8 | ✅ Ready |
| Tests | 1 suite | ✅ Passing 3/3 |
| Config files | 8 | ✅ Configured |
| Documentation | 6 | ✅ Complete |
| npm scripts | 15 | ✅ Available |

---

## 📝 File Organization Status

### ✅ Correct Locations (Use These)
- `src/js/` - All JavaScript source code
- `src/css/` - All stylesheets  
- `src/index.html` - Main HTML entry
- `dist/` - Production build output
- `.github/workflows/` - CI/CD pipeline
- `package.json` - Project config

### ⚠️ Old Files (Optional Cleanup)
- `css/` - Remove (use src/css/)
- `js/` - Remove (use src/js/)
- `assets/` - Remove (use public/)
- `index.html` (root) - Remove (use src/index.html)
- `script.js` (root) - Remove (use src/js/index.js)

**Cleanup command:**
```bash
rm -rf css/ js/ assets/ index.html script.js
```

---

## 🔧 Development Workflow

1. **Edit files** in `src/` directory
2. **Run** `npm run dev` for auto-rebuild
3. **Refresh browser** to see changes
4. **Test** with `npm run test:watch`
5. **Build** with `npm run build` for production

---

## 📚 Documentation Guide

| Need | File | Use |
|------|------|-----|
| How to develop | `DEVELOPMENT.md` | Setup, best practices |
| What's new | `ENHANCEMENTS.md` | Feature summary |
| Refactoring plan | `REFACTORING_GUIDE.md` | ES modules migration |
| Folder structure | `STRUCTURE_VERIFICATION.md` | Organization details |
| Visual tree | `FOLDER_TREE.txt` | Folder layout |
| Project overview | `README.md` | Getting started |

---

## ✅ Verification Checklist

Run this to verify everything works:

```bash
# 1. Build
npm run build:fast

# 2. Test
npm run test

# 3. Format check
npm run format:check

# 4. Lint check
npm run lint:check

# 5. Full validation
npm run validate
```

✅ All should pass without errors.

---

## 🎯 Key Points

1. **Always edit in `src/`** - Never edit dist/
2. **Run `npm run dev`** - Before starting work
3. **Use `npm run validate`** - Before committing
4. **Check `npm run build`** - Before pushing
5. **Tests should pass** - All 3 tests passing ✅

---

## 📞 Quick Help

**"My changes aren't showing"**
- Make sure you're editing files in `src/` not `dist/`
- Run `npm run dev` to watch for changes

**"Build is failing"**
- Run `npm run validate` to see what's wrong
- Check console output for specific errors

**"Tests are failing"**
- Run `npm run test:watch` for interactive mode
- Check `src/js/__tests__/` for test examples

**"Code looks messy"**
- Run `npm run format` to auto-format all code
- Run `npm run lint` to auto-fix style issues

---

## 🚀 Project Status

| Item | Status |
|------|--------|
| Structure | ✅ Organized (A+) |
| Build System | ✅ Working |
| Tests | ✅ Passing (3/3) |
| Linting | ✅ Configured |
| Formatting | ✅ Applied |
| TypeScript | ✅ Ready |
| CI/CD | ✅ Setup |
| Documentation | ✅ Complete |

**Everything is set up and ready to go! 🎉**

---

**Last Updated:** April 13, 2026  
**Project Version:** 2.0.0 (Enhanced)
