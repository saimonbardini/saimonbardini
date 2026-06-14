const fs = require('fs');
const https = require('https');

const GITHUB_TOKEN = process.env.GH_TOKEN;
const USERNAME = 'saimonbardini';

async function fetchGitHubData() {
    const query = JSON.stringify({
        query: `{
            user(login: "${USERNAME}") {
                repositories(privacy: PUBLIC) { totalCount }
                contributionsCollection { totalCommitContributions }
                repositories(first: 100, ownerAffiliations: OWNER) {
                    nodes {
                        languages(first: 5, orderBy: {field: SIZE, direction: DESC}) {
                            edges { size node { name color } }
                        }
                    }
                }
            }
        }`
    });

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: '/graphql',
            method: 'POST',
            headers: {
                'Authorization': `bearer ${GITHUB_TOKEN}`,
                'User-Agent': 'NodeJS',
                'Content-Type': 'application/json',
                'Content-Length': query.length
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (d) => data += d);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', reject);
        req.write(query);
        req.end();
    });
}

function generateSVG(repos, commits) {
    return `
    <svg width="400" height="150" viewBox="0 0 400 150" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="150" rx="10" fill="#0d1117" stroke="#30363d"/>
        <text x="20" y="35" font-family="Segoe UI" font-weight="bold" font-size="18" fill="#58a6ff">Status do Perfil</text>
        
        <g font-family="Segoe UI" font-size="14" fill="#c9d1d9">
            <text x="20" y="70">Repositórios Públicos:</text>
            <text x="200" y="70" font-weight="bold" fill="#f0f6fc">${repos}</text>
            
            <text x="20" y="100">Commits (Este Ano):</text>
            <text x="200" y="100" font-weight="bold" fill="#f0f6fc">${commits}</text>
        </g>
        
        <rect x="20" y="125" width="360" height="8" rx="4" fill="#21262d"/>
        <rect x="20" y="125" width="280" height="8" rx="4" fill="#238636"/>
    </svg>`;
}

async function main() {
    try {
        if (!GITHUB_TOKEN) throw new Error("GH_TOKEN não configurado!");
        
        const result = await fetchGitHubData();
        const user = result.data.user;
        
        const svg = generateSVG(
            user.repositories.totalCount,
            user.contributionsCollection.totalCommitContributions
        );

        if (!fs.existsSync('assets')) fs.mkdirSync('assets');
        fs.writeFileSync('assets/stats.svg', svg);
        console.log("SVG gerado com sucesso!");
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

main();
