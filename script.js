class EndlessRunner {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.gameRunning = false;
        this.gameOver = false;
        this.score = 0;
        this.menuVisible = 'startMenu';
        this.gameSpeed = 5;
        this.speedIncrement = 0.002;

        // Background elements
        this.clouds = [];
        this.groundOffset = 0;
        this.mountains = [];
        
        this.bestScore = parseInt(localStorage.getItem('bestScore')) || 0;
        this.skins = [
            { id: 1, src: 'assets/player.png', price: 0 },
            { id: 2, src: 'assets/skin_2.png', price: 40 },
            { id: 4, src: 'assets/skin_3.png', price: 60 }
        ];
        this.purchasedSkins = JSON.parse(localStorage.getItem('purchasedSkins')) || [1];
        this.currentSkinSrc = localStorage.getItem('currentSkinSrc') || this.skins[0].src;
        this.selectedSkinId = null;
        
        this.player = {
            x: 100,
            y: 450,
            width: 60,
            height: 60,
            velocityY: 0,
            isJumping: false,
            jumpPower: -16,
            gravity: 0.8,
            animFrame: 0,
            animSpeed: 0.2
        };
        this.playerImage = new Image();
        
        this.groundY = 510;
        
        this.obstacles = [];
        this.obstacleSpeed = 5;
        this.minObstacleDistance = 200;
        this.maxObstacleDistance = 400;
        this.lastObstacleX = 800;
        this.obstacleTypes = ['ground', 'air', 'double'];
        this.obstacleImage = new Image();
        this.obstacleImage.src = 'assets/obstacles.png';
        
        this.ui = {
            gameUi: document.getElementById('gameUi'),
            instructions: document.getElementById('instructions'),
            startMenu: document.getElementById('startMenu'),
            gameOverMenu: document.getElementById('gameOverMenu'),
            shopMenu: document.getElementById('shopMenu'),
            shopItemsContainer: document.querySelector('.shop-items'),
            shopPoints: document.getElementById('shopPoints'),
            shopMessage: document.getElementById('shopMessage'),
        };

        // Sound effects
        this.jumpSound = this.createJumpSound();
        
        this.init();
    }
    
    createJumpSound() {
        // Create a simple jump sound using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        return () => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        };
    }
    
    async init() {
        await this.loadPlayerSkin(this.currentSkinSrc);
        this.initBackground();
        this.setupEventListeners();
        this.showMenu('startMenu');
        this.draw();
    }
    
    initBackground() {
        // Initialize clouds
        for (let i = 0; i < 5; i++) {
            this.clouds.push({
                x: Math.random() * this.canvas.width,
                y: 50 + Math.random() * 100,
                size: 30 + Math.random() * 40,
                speed: 0.5 + Math.random() * 1
            });
        }
        
        // Initialize mountains
        for (let i = 0; i < 3; i++) {
            this.mountains.push({
                x: i * 300,
                y: 350,
                width: 200 + Math.random() * 100,
                height: 100 + Math.random() * 50,
                speed: 1
            });
        }
    }
    
    async loadPlayerSkin(src) {
        return new Promise((resolve, reject) => {
            this.playerImage.src = src;
            this.playerImage.onload = () => resolve();
            this.playerImage.onerror = () => {
                console.error(`Failed to load skin: ${src}. Using fallback.`);
                this.playerImage = null;
                resolve();
            };
        });
    }

    showMenu(menuId) {
        this.ui.startMenu.style.display = 'none';
        this.ui.gameOverMenu.style.display = 'none';
        this.ui.shopMenu.style.display = 'none';
        this.ui.gameUi.style.display = 'none';
        this.ui.instructions.style.display = 'none';

        if (menuId) {
            this.ui[menuId].style.display = 'block';
            this.menuVisible = menuId;
        }
    }
    
    setupEventListeners() {
        document.getElementById('startPlayBtn').addEventListener('click', () => this.startGame());
        document.getElementById('playAgainBtn').addEventListener('click', () => this.startGame());
        document.getElementById('startShopBtn').addEventListener('click', () => this.openShop());
        document.getElementById('gameOverShopBtn').addEventListener('click', () => this.openShop());
        document.getElementById('exitShopBtn').addEventListener('click', () => this.closeShop());
        document.getElementById('buyBtn').addEventListener('click', () => this.buySelectedSkin());

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.gameRunning && !this.gameOver) {
                e.preventDefault();
                this.jump();
            }
        });
    }

    openShop() {
        this.showMenu('shopMenu');
        this.ui.shopPoints.textContent = this.bestScore;
        this.ui.shopMessage.textContent = '';
        this.selectedSkinId = null;
        this.renderShopItems();
    }

    closeShop() {
        this.showMenu(this.menuVisible === 'gameOverMenu' ? 'gameOverMenu' : 'startMenu');
    }

    renderShopItems() {
        this.ui.shopItemsContainer.innerHTML = '';
        this.skins.forEach(skin => {
            const isPurchased = this.purchasedSkins.includes(skin.id);
            const isEquipped = this.currentSkinSrc === skin.src;

            const itemDiv = document.createElement('div');
            itemDiv.className = 'shop-item';
            if (this.selectedSkinId === skin.id) {
                itemDiv.classList.add('selected');
            }

            itemDiv.innerHTML = `
                <img src="${skin.src}" alt="Skin ${skin.id}">
                <div class="shop-item-price">${skin.price > 0 ? `${skin.price} points` : 'Default'}</div>
                ${isPurchased ? `<div class="purchased-overlay"><span>${isEquipped ? '✔' : '✓'}</span></div>` : ''}
            `;

            itemDiv.addEventListener('click', () => this.selectSkin(skin));
            this.ui.shopItemsContainer.appendChild(itemDiv);
        });
    }

    selectSkin(skin) {
        this.selectedSkinId = skin.id;
        this.ui.shopMessage.textContent = '';
        this.renderShopItems();
    }

    async buySelectedSkin() {
        if (!this.selectedSkinId) {
            this.ui.shopMessage.textContent = 'Please select a skin first.';
            return;
        }

        const skin = this.skins.find(s => s.id === this.selectedSkinId);

        if (this.purchasedSkins.includes(skin.id)) {
            await this.equipSkin(skin);
            this.ui.shopMessage.textContent = 'Skin equipped!';
        } else if (this.bestScore >= skin.price) {
            this.bestScore -= skin.price;
            this.purchasedSkins.push(skin.id);
            await this.equipSkin(skin);

            localStorage.setItem('bestScore', this.bestScore);
            localStorage.setItem('purchasedSkins', JSON.stringify(this.purchasedSkins));

            this.ui.shopPoints.textContent = this.bestScore;
            this.ui.shopMessage.textContent = 'Purchase successful! Skin equipped.';
        } else {
            this.ui.shopMessage.textContent = "Not enough points!";
        }
        this.renderShopItems();
    }

    async equipSkin(skin) {
        this.currentSkinSrc = skin.src;
        localStorage.setItem('currentSkinSrc', this.currentSkinSrc);
        await this.loadPlayerSkin(this.currentSkinSrc);
    }
    
    startGame() {
        this.gameRunning = true;
        this.gameOver = false;
        this.score = 0;
        this.obstacles = [];
        this.gameSpeed = 5;
        this.lastObstacleX = 800;
        
        this.player.y = this.groundY - this.player.height;
        this.player.velocityY = 0;
        this.player.isJumping = false;
        this.player.animFrame = 0;
        
        this.showMenu(null);
        this.ui.gameUi.style.display = 'block';
        this.ui.instructions.style.display = 'block';
        this.updateUI();
        this.gameLoop();
    }
    
    gameLoop() {
        if (!this.gameRunning || this.gameOver) return;
        
        this.updateBackground();
        this.updatePlayer();
        this.spawnObstacle();
        this.updateObstacles();
        this.checkCollisions();
        this.updateGameSpeed();
        this.draw();

        requestAnimationFrame(() => this.gameLoop());
    }
    
    updateBackground() {
        // Update ground offset
        this.groundOffset += this.gameSpeed;
        if (this.groundOffset >= 40) this.groundOffset = 0;
        
        // Update clouds
        this.clouds.forEach(cloud => {
            cloud.x -= cloud.speed;
            if (cloud.x + cloud.size < 0) {
                cloud.x = this.canvas.width + Math.random() * 200;
                cloud.y = 50 + Math.random() * 100;
            }
        });
        
        // Update mountains
        this.mountains.forEach(mountain => {
            mountain.x -= mountain.speed;
            if (mountain.x + mountain.width < 0) {
                mountain.x = this.canvas.width + Math.random() * 100;
            }
        });
    }
    
    updateGameSpeed() {
        this.gameSpeed += this.speedIncrement;
        this.obstacleSpeed = this.gameSpeed;
    }
    
    endGame() {
        this.gameRunning = false;
        this.gameOver = true;
        
        let isNewRecord = false;
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('bestScore', this.bestScore.toString());
            isNewRecord = true;
        }
        
        this.showGameOverMenu(isNewRecord);
    }

    showGameOverMenu(isNewRecord) {
        this.showMenu('gameOverMenu');
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('newRecord').style.display = isNewRecord ? 'block' : 'none';
        this.updateUI();
    }

    updateUI() {
        document.getElementById('currentScore').textContent = this.score;
        document.getElementById('bestScore').textContent = this.bestScore;
    }
    
    jump() {
        if (!this.player.isJumping) {
            this.player.velocityY = this.player.jumpPower;
            this.player.isJumping = true;
            
            // Play jump sound
            try {
                this.jumpSound();
            } catch (e) {
                console.log('Could not play jump sound');
            }
        }
    }
    
    updatePlayer() {
        // Update physics
        this.player.velocityY += this.player.gravity;
        this.player.y += this.player.velocityY;
        
        if (this.player.y >= this.groundY - this.player.height) {
            this.player.y = this.groundY - this.player.height;
            this.player.velocityY = 0;
            this.player.isJumping = false;
        }
        
        // Update running animation
        if (!this.player.isJumping) {
            this.player.animFrame += this.player.animSpeed;
            if (this.player.animFrame >= 2) this.player.animFrame = 0;
        }
    }
    
    spawnObstacle() {
        if (this.canvas.width - this.lastObstacleX >= this.minObstacleDistance + Math.random() * (this.maxObstacleDistance - this.minObstacleDistance)) {
            const obstacleType = this.obstacleTypes[Math.floor(Math.random() * this.obstacleTypes.length)];
            
            switch (obstacleType) {
                case 'ground':
                    this.obstacles.push({
                        x: this.canvas.width,
                        y: this.groundY - 40,
                        width: 30,
                        height: 40,
                        type: 'ground'
                    });
                    break;
                    
                case 'air':
                    this.obstacles.push({
                        x: this.canvas.width,
                        y: this.groundY - 120,
                        width: 35,
                        height: 35,
                        type: 'air'
                    });
                    break;
                    
                case 'double':
                    this.obstacles.push({
                        x: this.canvas.width,
                        y: this.groundY - 40,
                        width: 25,
                        height: 40,
                        type: 'ground'
                    });
                    this.obstacles.push({
                        x: this.canvas.width + 40,
                        y: this.groundY - 40,
                        width: 25,
                        height: 40,
                        type: 'ground'
                    });
                    break;
            }
            
            this.lastObstacleX = this.canvas.width;
        }
    }
    
    updateObstacles() {
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacle = this.obstacles[i];
            obstacle.x -= this.obstacleSpeed;
            
            if (!obstacle.passed && obstacle.x + obstacle.width < this.player.x) {
                obstacle.passed = true;
                this.score += 1;
                this.updateUI();
            }
            
            if (obstacle.x + obstacle.width < 0) {
                this.obstacles.splice(i, 1);
            }
        }
        
        // Update lastObstacleX
        if (this.obstacles.length > 0) {
            this.lastObstacleX = Math.max(...this.obstacles.map(obs => obs.x));
        } else {
            this.lastObstacleX = 0;
        }
    }
    
    checkCollisions() {
        for (const obstacle of this.obstacles) {
            if (this.player.x < obstacle.x + obstacle.width - 10 &&
                this.player.x + this.player.width - 10 > obstacle.x &&
                this.player.y < obstacle.y + obstacle.height - 10 &&
                this.player.y + this.player.height - 10 > obstacle.y) {
                this.endGame();
                return;
            }
        }
    }
    
    drawBackground() {
        // Sky gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(0.5, '#E0F6FF');
        gradient.addColorStop(0.9, '#DEB887');
        gradient.addColorStop(1, '#8B7355');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw mountains
        this.ctx.fillStyle = '#696969';
        this.mountains.forEach(mountain => {
            this.ctx.beginPath();
            this.ctx.moveTo(mountain.x, mountain.y + mountain.height);
            this.ctx.lineTo(mountain.x + mountain.width / 2, mountain.y);
            this.ctx.lineTo(mountain.x + mountain.width, mountain.y + mountain.height);
            this.ctx.closePath();
            this.ctx.fill();
        });
        
        // Draw clouds
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.clouds.forEach(cloud => {
            this.ctx.beginPath();
            this.ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
            this.ctx.arc(cloud.x + cloud.size * 0.7, cloud.y, cloud.size * 0.8, 0, Math.PI * 2);
            this.ctx.arc(cloud.x + cloud.size * 1.4, cloud.y, cloud.size * 0.6, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        // Draw moving ground pattern
        this.ctx.strokeStyle = '#8B7355';
        this.ctx.lineWidth = 2;
        for (let i = -this.groundOffset; i < this.canvas.width; i += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(i, this.groundY + 5);
            this.ctx.lineTo(i + 20, this.groundY + 5);
            this.ctx.stroke();
        }
    }
    
    draw() {
        // Clear and draw background
        this.drawBackground();
        
        // Draw ground line
        this.ctx.strokeStyle = '#2F4F4F';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.groundY);
        this.ctx.lineTo(this.canvas.width, this.groundY);
        this.ctx.stroke();
        
        // Draw player with animation
        if (this.playerImage && this.playerImage.complete) {
            // Simple running animation by slightly bouncing the player
            let bounceOffset = 0;
            if (!this.player.isJumping) {
                bounceOffset = Math.sin(this.player.animFrame * Math.PI) * 2;
            }
            
            this.ctx.drawImage(
                this.playerImage, 
                this.player.x, 
                this.player.y + bounceOffset, 
                this.player.width, 
                this.player.height
            );
        } else {
            // Fallback rectangle with animation
            this.ctx.fillStyle = this.player.isJumping ? '#45a049' : '#4CAF50';
            this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
        }
        
        // Draw obstacles with different colors based on type
        for (const obstacle of this.obstacles) {
            if (this.obstacleImage.complete && this.obstacleImage.src) {
                this.ctx.drawImage(this.obstacleImage, obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            } else {
                // Different colors for different obstacle types
                switch (obstacle.type) {
                    case 'ground':
                        this.ctx.fillStyle = '#8B4513';
                        break;
                    case 'air':
                        this.ctx.fillStyle = '#DC143C';
                        break;
                    default:
                        this.ctx.fillStyle = '#FF5722';
                }
                this.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
                
                // Add some visual effects
                if (obstacle.type === 'air') {
                    // Draw wings or spikes for flying obstacles
                    this.ctx.fillStyle = '#B22222';
                    this.ctx.fillRect(obstacle.x - 5, obstacle.y + 10, 10, 15);
                    this.ctx.fillRect(obstacle.x + obstacle.width - 5, obstacle.y + 10, 10, 15);
                }
            }
        }
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    new EndlessRunner();
});