const fs = require('fs');
const path = require('path');

function detectLaunchDarklySingletonViolations(targetPath = '.') {
    let hasViolations = false;
    let hasLaunchDarkly = false;
    const violations = [];

    function analyzeFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Check if file uses LaunchDarkly
            const hasLDImport = /require.*launchdarkly|import.*launchdarkly|from.*launchdarkly/gi.test(content);
            if (!hasLDImport) return;
            
            hasLaunchDarkly = true;
            
            // Count client initializations
            const initMatches = content.match(/\.init\s*\(/g) || [];
            const initCount = initMatches.length;
            
            // Check for violations
            if (initCount > 1) {
                hasViolations = true;
                violations.push(`${filePath}: Multiple initializations (${initCount})`);
            }
            
            // Check for initialization in loops
            if (/for\s*\([^)]*\)[^}]*\.init\s*\(|while\s*\([^)]*\)[^}]*\.init\s*\(|forEach[^}]*\.init\s*\(/g.test(content)) {
                hasViolations = true;
                violations.push(`${filePath}: Initialization in loop`);
            }
            
            // Check for initialization in request handlers
            if (/app\.(get|post|put|delete)[^}]*\.init\s*\(|function.*req.*res[^}]*\.init\s*\(/g.test(content)) {
                hasViolations = true;
                violations.push(`${filePath}: Initialization in request handler`);
            }
            
        } catch (error) {
            // Skip files that can't be read
        }
    }

    function scanDirectory(dirPath) {
        const files = fs.readdirSync(dirPath);
        
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
                scanDirectory(filePath);
            } else if (stat.isFile() && (file.endsWith('.js') || file.endsWith('.ts'))) {
                analyzeFile(filePath);
            }
        }
    }

    // Start analysis
    if (fs.statSync(targetPath).isDirectory()) {
        scanDirectory(targetPath);
    } else {
        analyzeFile(targetPath);
    }

    return {
        hasLaunchDarkly,
        hasViolations,
        violations
    };
}

// Example usage
const targetPath = process.argv[2] || '.';
const result = detectLaunchDarklySingletonViolations(targetPath);

if (!result.hasLaunchDarkly) {
    console.log("No LaunchDarkly usage found.");
} else if (result.hasViolations) {
    console.log(" Singleton violations found:");
    result.violations.forEach(violation => console.log(`  ${violation}`));
} else {
    console.log("No singleton violations found.");
}
