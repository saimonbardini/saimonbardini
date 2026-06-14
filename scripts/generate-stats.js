const fs = require('fs');
const https = require('https');

const GITHUB_TOKEN = process.env.GH_TOKEN;
const USERNAME = 'saimonbardini';

async function fetchGitHubData() {
    const query = JSON.stringify({
        query: `{
            user(login: "${USERNAME}") {
                repositories(privacy: PUBLIC) { totalCount }
                contributionsCollection {
                    totalCommitContributions
                }
                topLanguages: repositories(first: 100, ownerAffiliations: OWNER, orderBy: {field: UPDATED_AT, direction: DESC}) {
                    nodes { languages(first: 5) { edges { size node { name color } } } }
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
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
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

function processLanguages(data) {
    const langs = {};
    let totalSize = 0;
    
    if (!data.topLanguages || !data.topLanguages.nodes) return [];

    data.topLanguages.nodes.forEach(repo => {
        if (repo.languages && repo.languages.edges) {
            repo.languages.edges.forEach(edge => {
                langs[edge.node.name] = {
                    size: (langs[edge.node.name]?.size || 0) + edge.size,
                    color: edge.node.color
                };
                totalSize += edge.size;
            });
        }
    });

    return Object.entries(langs)
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, 5)
        .map(([name, info]) => ({
            name,
            percent: parseFloat(((info.size / totalSize) * 100).toFixed(1)),
            color: info.color
        }));
}

function generateSVG(repos, commits, languages) {
    const width = 400;
    const height = 160;
    
    const langElements = languages.map((l, i) => `
        <g transform="translate(20, ${82 + (i * 14)})">
            <text x="0" y="9" fill="#c9d1d9" font-family="Segoe UI" font-size="10">${l.name}</text>
            <rect x="75" y="2" width="250" height="6" rx="3" fill="#21262d"/>
            <rect x="75" y="2" width="${(l.percent * 2.5)}" height="6" rx="3" fill="${l.color || '#58a6ff'}"/>
            <text x="330" y="9" fill="#8b949e" font-family="Segoe UI" font-size="9">${l.percent}%</text>
        </g>
    `).join('');

    return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <rect width="${width-2}" height="${height-2}" x="1" y="1" rx="8" fill="#0d1117" stroke="#30363d"/>
        <text x="20" y="25" font-family="Segoe UI" font-weight="bold" font-size="16" fill="#58a6ff">Saimon Bardini - Stats</text>
        
        <g font-family="Segoe UI" font-size="12" fill="#c9d1d9">
            <text x="20" y="50">Repositórios:</text>
            <text x="95" y="50" font-weight="bold" fill="#f0f6fc">${repos}</text>
            
            <text x="160" y="50">Total Commits:</text>
            <text x="250" y="50" font-weight="bold" fill="#f0f6fc">${commits}</text>
        </g>
        
        <line x1="20" y1="65" x2="${width-20}" y2="65" stroke="#30363d" />
        
        ${langElements}
    </svg>`;
}

async function main() {
    try {
        if (!GITHUB_TOKEN) throw new Error("GH_TOKEN não configurado!");
        
        const result = await fetchGitHubData();

        // Tratamento de erro detalhado
        if (result && result.errors) {
            console.error("❌ Erro na API do GitHub:", JSON.stringify(result.errors, null, 2));
            process.exit(1);
        }

        if (!result.data || !result.data.user) {
            console.error("❌ Resposta inesperada (verifique seu Token):", JSON.stringify(result, null, 2));
            process.exit(1);
        }

        const user = result.data.user;
        
        const languages = processLanguages(user);
        const svg = generateSVG(
            user.repositories.totalCount,
            user.contributionsCollection.totalCommitContributions,
            languages
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
