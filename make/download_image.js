#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

function downloadFile(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;

        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://github.com/',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            }
        };

        client.get(url, options, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                downloadFile(response.headers.location).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                reject(new Error(`下载失败: HTTP ${response.statusCode}`));
                return;
            }

            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        }).on('error', reject);
    });
}

// 使用 macOS sips 命令压缩图片
function compressImageWithSips(inputPath, outputPath, targetSizeKB) {
    // sips -s format jpeg -s formatOptions 80 input --out output
    try {
        execSync(`sips -s format jpeg -s formatOptions 80 "${inputPath}" --out "${outputPath}"`, { stdio: 'ignore' });
    } catch (e) {
        throw new Error('sips 转换失败，请确保是 macOS 系统');
    }

    let currentSize = fs.statSync(outputPath).size;
    let quality = 80;

    console.log(`📊 初始大小: ${(currentSize / 1024).toFixed(2)} KB`);

    // 2. 如果太大，降低质量
    while (currentSize > targetSizeKB * 1024 && quality > 10) {
        quality -= 10;
        execSync(`sips -s formatOptions ${quality} "${outputPath}"`, { stdio: 'ignore' });
        currentSize = fs.statSync(outputPath).size;
        console.log(`🔄 降质到 ${quality}: ${(currentSize / 1024).toFixed(2)} KB`);
    }

    // 3. 如果还是太大，缩小尺寸 (每次缩小 10%)
    while (currentSize > targetSizeKB * 1024) {
        // 获取当前宽度
        const widthOutput = execSync(`sips -g pixelWidth "${outputPath}"`, { encoding: 'utf8' });
        const currentWidth = parseInt(widthOutput.match(/pixelWidth: (\d+)/)[1]);

        if (currentWidth < 300) break; // 最小宽度保护

        const newWidth = Math.floor(currentWidth * 0.9);
        execSync(`sips -Z ${newWidth} "${outputPath}"`, { stdio: 'ignore' });

        currentSize = fs.statSync(outputPath).size;
        console.log(`📐 缩放至宽 ${newWidth}: ${(currentSize / 1024).toFixed(2)} KB`);
    }
}

// 从 URL 提取文件名
function extractFilename(url) {
    try {
        const urlPath = new URL(url).pathname;
        const filename = path.basename(urlPath);
        return filename.replace(/\.[^.]+$/, '');
    } catch (e) {
        return 'image';
    }
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('用法: node download_image.js <url> [name]');
        process.exit(1);
    }

    const url = args[0];
    let filename = args[1];

    if (!filename) {
        filename = extractFilename(url);
        console.log(`📝 自动提取文件名: ${filename}`);
    }

    console.log(`\n🚀 开始处理... URL: ${url}`);

    try {
        // 1. 下载
        console.log('⬇️  下载中...');
        const buffer = await downloadFile(url);

        // 2. 保存临时文件
        const tempPath = path.join(__dirname, '.temp_download');
        fs.writeFileSync(tempPath, buffer);

        // 3. 准备输出路径
        const imagesDir = path.join(__dirname, '..', 'images');
        if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir, { recursive: true });
        }
        const outputPath = path.join(imagesDir, `${filename}.jpg`); // 统一转为 jpg

        // 4. 压缩
        console.log('🗜️  压缩中 (使用 macOS sips)...');
        compressImageWithSips(tempPath, outputPath, 400);

        // 5. 清理
        fs.unlinkSync(tempPath);

        // 6. 结果
        const finalSize = (fs.statSync(outputPath).size / 1024).toFixed(2);
        console.log(`\n✅ 已保存: images/${filename}.jpg (${finalSize} KB)`);

        const cdnUrl = `https://cdn.jsdelivr.net/gh/glidea/banana-prompt-quicker@main/images/${filename}.jpg`;
        console.log(`📋 CDN: ${cdnUrl}`);

        try {
            execSync(`echo "${cdnUrl}" | pbcopy`);
            console.log('✨ 已复制到剪贴板');
        } catch (e) { }

    } catch (error) {
        console.error('\n❌ 错误:', error.message);
        process.exit(1);
    }
}

main();
