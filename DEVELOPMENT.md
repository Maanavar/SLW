# Development Guide

Complete guide for developers working on the Siva Lathe Works project.

## 📋 Table of Contents

- [Setup](#setup)
- [Development Workflow](#development-workflow)
- [Code Quality Tools](#code-quality-tools)
- [Testing](#testing)
- [Building](#building)
- [CI/CD Pipeline](#cicd-pipeline)
- [Best Practices](#best-practices)

## Setup

### Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- Git

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd SLW

# Install dependencies
npm install

# Verify setup
npm run validate
```

## Development Workflow

### Starting Development

```bash
npm run dev
```

This will:
1. Copy static assets to dist/
2. Watch for file changes
3. Rebuild automatically
4. Output to dist/app.js

### Development Cycle

1. **Make changes** in `src/` directory
2. **Auto-rebuild** happens automatically
3. **Refresh browser** to see changes
4. **Check for errors** in terminal

### Project Structure

```
src/
├── index.html          # Main HTML
├── js/
│   ├── index.js        # Bundled entry point
│   ├── app.js          # App initialization
│   ├── utils.js        # Utilities
│   └── __tests__/       # Test files
└── css/
    ├── styles.css      # Main styles
    ├── components.css  # Component styles
    └── ...
```

## Code Quality Tools

### ESLint - Code Quality

Enforces consistent code style and catches potential bugs.

**Run linter:**
```bash
npm run lint          # Fix issues automatically
npm run lint:check    # Check without fixing
```

**Configuration:** `.eslintrc.json`

**Disabled rules (when needed):**
```javascript
// eslint-disable-next-line rule-name
const result = problematicCode();
```

### Prettier - Code Formatting

Automatically formats code to consistent style.

**Format code:**
```bash
npm run format         # Format all files
npm run format:check   # Check without formatting
```

**Configuration:** `.prettierrc.json`

**Ignored files:** `.prettierignore`

### TypeScript - Type Safety

Optional type checking without full TypeScript migration.

**Type check (without compiling):**
```bash
npm run type-check
```

**Configuration:** `tsconfig.json`

## Testing

### Jest - Unit Testing

Test framework with jsdom environment for DOM testing.

**Run tests:**
```bash
npm run test           # Run tests once
npm run test:watch    # Watch mode (re-run on changes)
npm run test:coverage # Generate coverage report
```

**Configuration:** `jest.config.js`, `jest.setup.js`

### Writing Tests

Tests are placed in `__tests__/` directories with `.test.js` extension.

**Example test:**
```javascript
describe('My Feature', () => {
  test('should do something', () => {
    const result = myFunction();
    expect(result).toBe(expectedValue);
  });

  test('should handle edge case', () => {
    expect(() => {
      myFunction(invalidInput);
    }).toThrow();
  });
});
```

**Test coverage targets:**
- Branches: 50%
- Functions: 50%
- Lines: 50%
- Statements: 50%

### Jest Mocking

localStorage is automatically mocked in tests:

```javascript
test('localStorage integration', () => {
  localStorage.setItem('key', 'value');
  expect(localStorage.setItem).toHaveBeenCalledWith('key', 'value');
});
```

## Building

### Development Build

```bash
npm run build:fast
```

Bundles without running tests/linting (for quick iteration).

### Production Build

```bash
npm run build
```

Complete build that:
1. ✓ Runs linter
2. ✓ Checks code format
3. ✓ Runs tests
4. ✓ Type checks
5. ✓ Bundles JavaScript
6. ✓ Minifies code
7. ✓ Copies assets to dist/

### Preview Production Build

```bash
npm run preview
```

Serves the dist/ folder locally at `http://localhost:8080`

## CI/CD Pipeline

### GitHub Actions

Automated testing and building on push/PR.

**Workflow file:** `.github/workflows/ci.yml`

**Jobs:**
1. **Quality** - Lint, format check, type check, tests
2. **Build** - Bundle and create artifacts
3. **Security** - npm audit

**Triggered on:**
- Push to main, master, develop
- Pull requests to main, master, develop

**Requirements to pass:**
- ✓ Code format matches Prettier
- ✓ All ESLint rules pass
- ✓ TypeScript types valid
- ✓ All tests pass
- ✓ Code builds successfully

## Best Practices

### Code Style

1. **Use const/let** - Never use var
   ```javascript
   // ✓ Good
   const value = 42;
   let count = 0;

   // ✗ Bad
   var oldStyle = 'avoid';
   ```

2. **Use strict equality** - Always use === and !==
   ```javascript
   // ✓ Good
   if (value === undefined) { }

   // ✗ Bad
   if (value == undefined) { }
   ```

3. **Remove unused variables** - Use _prefix for intentionally unused
   ```javascript
   // ✓ Good - intentionally unused
   const [name, _] = ['John', 'unused'];

   // ✗ Bad - unused
   const unused = 42;
   ```

4. **Use semicolons** - Always required
   ```javascript
   // ✓ Good
   const result = getValue();

   // ✗ Bad
   const result = getValue()
   ```

### Testing

1. **Write meaningful tests**
   ```javascript
   // ✓ Clear test name
   test('should calculate total price with tax', () => {
     const result = calculatePrice(100, 0.18);
     expect(result).toBe(118);
   });

   // ✗ Unclear test name
   test('test function', () => {
     expect(calculatePrice(100, 0.18)).toBe(118);
   });
   ```

2. **Test edge cases**
   ```javascript
   describe('Payment calculator', () => {
     test('handles positive amounts', () => { });
     test('handles zero amounts', () => { });
     test('rejects negative amounts', () => { });
   });
   ```

3. **Mock external dependencies**
   ```javascript
   test('uses localStorage', () => {
     localStorage.setItem('key', 'value');
     expect(localStorage.setItem).toHaveBeenCalled();
   });
   ```

### Commits

1. **Use meaningful commit messages**
   ```
   ✓ feat: add job export functionality
   ✓ fix: correct payment calculation bug
   ✓ test: add coverage for utils module
   ✓ docs: update README with examples

   ✗ fixed stuff
   ✗ update
   ✗ changes
   ```

2. **Commit frequently** - Small, logical commits are easier to review

3. **Run validation before pushing**
   ```bash
   npm run validate
   ```

### Code Organization

1. **One responsibility per function**
   ```javascript
   // ✓ Good - focused functions
   function validateEmail(email) { }
   function formatEmail(email) { }

   // ✗ Bad - mixed concerns
   function processEmail(email) { /* validation + formatting */ }
   ```

2. **Keep functions small** - Aim for < 50 lines
3. **Use descriptive names** - `getActivCustomers()` not `getData()`
4. **Add comments for complex logic**
   ```javascript
   // Calculate weighted average considering job priority
   const weighted = jobs.reduce((sum, job) => {
     return sum + (job.amount * job.priority);
   }, 0) / jobs.length;
   ```

## Troubleshooting

### Build fails with duplicate function errors

**Issue:** esbuild complains about duplicate declarations
**Solution:** Refactor to use proper ES modules or check index.js for duplicates

### Tests fail with "Cannot find module"

**Issue:** Module paths not resolving
**Solution:** Check tsconfig.json paths configuration

### Port 8080 already in use

**Issue:** Preview server can't start
**Solution:** 
```bash
npm run preview -- -p 8081  # Use different port
```

### Node modules corrupted

**Issue:** Strange errors after update
**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

## Resources

- [Jest Documentation](https://jestjs.io/)
- [ESLint Rules](https://eslint.org/docs/rules/)
- [Prettier Options](https://prettier.io/docs/en/options.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [GitHub Actions](https://docs.github.com/en/actions)

---

**Last Updated:** April 2026  
**Version:** 2.0.0
