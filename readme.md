# Browser Automation Repository

This repository provides tools and scripts for browser automation, data extraction, and web utilities. It includes utilities for working with CSV and XLSX data, log analysis, web scraping, and more. The project is modular, with scripts and packages organized for easy maintenance and extension.

## Features

- Download and process Google Sheets and XLSX files
- Log analysis and rendering tools
- Puppeteer-based browser automation utilities
- Static site generation and deployment scripts
- Data conversion and extraction utilities
- Modular structure for easy extension

## Project Structure

- `src/` - Source code for utilities, helpers, and automation scripts
- `scripts/` - Build, deployment, and plugin scripts
- `test/` - Test scripts and test data
- `public/` - Static assets and generated HTML
- `data/` - Data files and related scripts
- `packages/` - Additional packages and plugins

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [Yarn Berry (Yarn 2+)](https://yarnpkg.com/getting-started/install)
- optional: MySQL Server [read here](https://www.webmanajemen.com/2025/08/setup-mysql-for-multiple-devices.html)

## Getting Started

### 1. Clone the Repository

```sh
git clone https://github.com/dimaslanjaka/browser-automation.git
cd browser-automation
```

### 2. Set Up Yarn Berry

This project uses [Yarn Berry (Yarn 2+)](https://yarnpkg.com/). If you haven't already, set up Yarn Berry:

```sh
corepack enable
```

### 3. Install Dependencies

```sh
yarn install
```

### 4. Run Scripts

You can run various scripts defined in `package.json`. For example:

```sh
yarn start           # Start the main application (if defined)
yarn build           # Build the project
```

Or run specific scripts directly:

```sh
yarn node scripts/build-static-html-cli.js
```

### 5. Development

- Source files are in the `src/` directory.
- Scripts for building and deployment are in the `scripts/` directory.
- Tests are in the `test/` directory. Run tests with:

```sh
yarn test
```

### 6. Deployment

Deployment scripts (e.g., for GitHub Pages) are provided in the root and `scripts/` directories. See the script files and comments for usage details.

## Additional Notes

- Refer to individual script files for more detailed usage instructions.
- Contributions are welcome! Please follow the conventional commit style as described in `.github/instructions/all.instructions.md`.

---

For more information, see the inline documentation in each script and the comments in configuration files.
