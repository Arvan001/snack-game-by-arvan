class SnakeMultiplayer {
    constructor() {
        this.socket = null;
        this.user = null;
        this.gameState = null;
        this.canvas = null;
        this.ctx = null;
        this.gridSize = 20;
        this.roomId = "global";
        this.playerId = this.generatePlayerId();
        this.currentScore = 0;
        this.currentCoins = 0;
        
        this.initializeElements();
        this.initializeEventListeners();
        this.checkPreviousLogin();
    }

    generatePlayerId() {
        return 'player_' + Math.random().toString(36).substr(2, 9);
    }

    initializeElements() {
        this.elements = {
            authPage: document.getElementById('auth-page'),
            menuPage: document.getElementById('menu-page'),
            gamePage: document.getElementById('game-page'),
            shopPage: document.getElementById('shop-page'),
            leaderboardPage: document.getElementById('leaderboard-page'),
            
            usernameInput: document.getElementById('username'),
            passwordInput: document.getElementById('password'),
            loginBtn: document.getElementById('login-btn'),
            registerBtn: document.getElementById('register-btn'),
            authError: document.getElementById('auth-error'),
            
            displayUsername: document.getElementById('display-username'),
            totalScore: document.getElementById('total-score'),
            totalCoins: document.getElementById('total-coins'),
            
            joinGlobalBtn: document.getElementById('join-global'),
            createPrivateBtn: document.getElementById('create-private'),
            joinPrivateBtn: document.getElementById('join-private'),
            shopBtn: document.getElementById('shop-btn'),
            leaderboardBtn: document.getElementById('leaderboard-btn'),
            logoutBtn: document.getElementById('logout-btn'),
            
            roomCodeModal: document.getElementById('room-code-modal'),
            roomCodeInput: document.getElementById('room-code-input'),
            joinRoomBtn: document.getElementById('join-room-btn'),
            cancelJoinBtn: document.getElementById('cancel-join-btn'),
            
            currentScore: document.getElementById('current-score'),
            currentCoins: document.getElementById('current-coins'),
            playerCount: document.getElementById('player-count'),
            roomName: document.getElementById('room-name'),
            leaveGameBtn: document.getElementById('leave-game'),
            
            gameCanvas: document.getElementById('game-canvas'),
            
            shopCoins: document.getElementById('shop-coins'),
            skinsContainer: document.getElementById('skins-container'),
            backFromShop: document.getElementById('back-from-shop'),
            
            globalLeaderboard: document.getElementById('global-leaderboard'),
            backFromLeaderboard: document.getElementById('back-from-leaderboard'),
            
            upBtn: document.getElementById('up-btn'),
            leftBtn: document.getElementById('left-btn'),
            downBtn: document.getElementById('down-btn'),
            rightBtn: document.getElementById('right-btn'),
            
            eatSound: document.getElementById('eat-sound'),
            deathSound: document.getElementById('death-sound'),
            coinSound: document.getElementById('coin-sound')
        };

        this.canvas = this.elements.gameCanvas;
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size based on grid
        this.canvas.width = 40 * this.gridSize;
        this.canvas.height = 30 * this.gridSize;
    }

    initializeEventListeners() {
        // Auth events
        this.elements.loginBtn.addEventListener('click', () => this.login());
        this.elements.registerBtn.addEventListener('click', () => this.register());
        this.elements.passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });

        // Menu events
        this.elements.joinGlobalBtn.addEventListener('click', () => this.joinRoom('global'));
        this.elements.createPrivateBtn.addEventListener('click', () => this.createPrivateRoom());
        this.elements.joinPrivateBtn.addEventListener('click', () => this.showRoomCodeModal());
        this.elements.shopBtn.addEventListener('click', () => this.showShop());
        this.elements.leaderboardBtn.addEventListener('click', () => this.showLeaderboard());
        this.elements.logoutBtn.addEventListener('click', () => this.logout());

        // Room modal events
        this.elements.joinRoomBtn.addEventListener('click', () => this.joinPrivateRoom());
        this.elements.cancelJoinBtn.addEventListener('click', () => this.hideRoomCodeModal());

        // Game events
        this.elements.leaveGameBtn.addEventListener('click', () => this.leaveGame());

        // Shop events
        this.elements.backFromShop.addEventListener('click', () => this.showMenu());

        // Leaderboard events
        this.elements.backFromLeaderboard.addEventListener('click', () => this.showMenu());

        // Mobile controls
        this.elements.upBtn.addEventListener('click', () => this.sendDirection('UP'));
        this.elements.leftBtn.addEventListener('click', () => this.sendDirection('LEFT'));
        this.elements.downBtn.addEventListener('click', () => this.sendDirection('DOWN'));
        this.elements.rightBtn.addEventListener('click', () => this.sendDirection('RIGHT'));

        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (!this.elements.gamePage.classList.contains('active')) return;
            
            switch(e.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    e.preventDefault();
                    this.sendDirection('UP');
                    break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    e.preventDefault();
                    this.sendDirection('LEFT');
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    e.preventDefault();
                    this.sendDirection('DOWN');
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    e.preventDefault();
                    this.sendDirection('RIGHT');
                    break;
            }
        });

        // Window resize
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    checkPreviousLogin() {
        const token = localStorage.getItem('token');
        if (token) {
            this.autoLogin(token);
        }
    }

    async autoLogin(token) {
        try {
            const response = await fetch('/users/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                this.user = await response.json();
                this.updateUserDisplay();
                this.showMenu();
                return true;
            } else {
                localStorage.removeItem('token');
                return false;
            }
        } catch (error) {
            console.error('Auto-login failed:', error);
            return false;
        }
    }

    async login() {
        const username = this.elements.usernameInput.value.trim();
        const password = this.elements.passwordInput.value;

        if (!username || !password) {
            this.showAuthError('Please enter username and password');
            return;
        }

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
            });

            if (response.ok) {
                const data = await response.json();
                this.user = data.user;
                localStorage.setItem('token', data.access_token);
                this.updateUserDisplay();
                this.showMenu();
                this.hideAuthError();
            } else {
                this.showAuthError('Invalid username or password');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showAuthError('Connection error. Please try again.');
        }
    }

    async register() {
        const username = this.elements.usernameInput.value.trim();
        const password = this.elements.passwordInput.value;

        if (!username || !password) {
            this.showAuthError('Please enter username and password');
            return;
        }

        if (username.length < 3) {
            this.showAuthError('Username must be at least 3 characters');
            return;
        }

        if (password.length < 6) {
            this.showAuthError('Password must be at least 6 characters');
            return;
        }

        try {
            const response = await fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
            });

            if (response.ok) {
                this.showAuthError('Registration successful! Please login.', 'success');
                this.elements.usernameInput.value = '';
                this.elements.passwordInput.value = '';
            } else {
                const error = await response.json();
                this.showAuthError(error.detail || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showAuthError('Connection error. Please try again.');
        }
    }

    logout() {
        localStorage.removeItem('token');
        this.user = null;
        this.disconnectWebSocket();
        this.showAuthPage();
    }

    showAuthError(message, type = 'error') {
        this.elements.authError.textContent = message;
        this.elements.authError.style.color = type === 'success' ? '#4dff91' : '#ff4757';
    }

    hideAuthError() {
        this.elements.authError.textContent = '';
    }

    updateUserDisplay() {
        if (!this.user) return;
        
        this.elements.displayUsername.textContent = this.user.username;
        this.elements.totalScore.textContent = this.user.total_score;
        this.elements.totalCoins.textContent = this.user.total_coins;
    }

    showAuthPage() {
        this.hideAllPages();
        this.elements.authPage.classList.add('active');
        this.elements.usernameInput.focus();
    }

    showMenu() {
        this.hideAllPages();
        this.elements.menuPage.classList.add('active');
        this.updateUserDisplay();
    }

    showGamePage() {
        this.hideAllPages();
        this.elements.gamePage.classList.add('active');
        this.resizeCanvas();
        this.startGameLoop();
    }

    showShop() {
        this.hideAllPages();
        this.elements.shopPage.classList.add('active');
        this.loadShopSkins();
    }

    showLeaderboard() {
        this.hideAllPages();
        this.elements.leaderboardPage.classList.add('active');
        this.loadGlobalLeaderboard();
    }

    hideAllPages() {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
    }

    showRoomCodeModal() {
        this.elements.roomCodeModal.style.display = 'flex';
        this.elements.roomCodeInput.focus();
    }

    hideRoomCodeModal() {
        this.elements.roomCodeModal.style.display = 'none';
        this.elements.roomCodeInput.value = '';
    }

    createPrivateRoom() {
        const roomCode = Math.random().toString(36).substr(2, 6).toUpperCase();
        this.roomId = roomCode;
        this.connectWebSocket();
    }

    joinPrivateRoom() {
        const roomCode = this.elements.roomCodeInput.value.trim().toUpperCase();
        if (roomCode.length === 6) {
            this.roomId = roomCode;
            this.hideRoomCodeModal();
            this.connectWebSocket();
        }
    }

    joinRoom(roomId) {
        this.roomId = roomId;
        this.connectWebSocket();
    }

    connectWebSocket() {
        // Close existing connection
        if (this.socket) {
            this.socket.close();
        }

        // Get WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws/${this.playerId}`;

        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            console.log('WebSocket connected');
            this.sendWebSocketMessage({
                action: 'join_room',
                room_id: this.roomId,
                username: this.user.username,
                skin: this.user.current_skin,
                color: this.getSkinColor(this.user.current_skin)
            });
            this.showGamePage();
        };

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };

        this.socket.onclose = () => {
            console.log('WebSocket disconnected');
            // Try to reconnect after 3 seconds
            setTimeout(() => {
                if (this.elements.gamePage.classList.contains('active')) {
                    this.connectWebSocket();
                }
            }, 3000);
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    disconnectWebSocket() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    sendWebSocketMessage(message) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        }
    }

    sendDirection(direction) {
        this.sendWebSocketMessage({
            action: 'move',
            direction: direction
        });
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'room_joined':
                this.elements.roomName.textContent = data.room_id;
                break;
            
            case 'game_state':
                this.gameState = data.state;
                this.currentScore = data.state.players[this.playerId]?.score || 0;
                this.currentCoins = data.state.players[this.playerId]?.coins || 0;
                
                this.elements.currentScore.textContent = this.currentScore;
                this.elements.currentCoins.textContent = this.currentCoins;
                this.elements.playerCount.textContent = Object.keys(data.state.players).length;
                
                this.updateLeaderboard(data.leaderboard);
                break;
            
            case 'player_joined':
                // Play join sound if available
                break;
            
            case 'player_left':
                // Update UI
                break;
        }
    }

    updateLeaderboard(leaderboard) {
        const content = this.elements.leaderboardContent;
        content.innerHTML = '';
        
        leaderboard.slice(0, 5).forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            if (player.username === this.user.username) {
                item.classList.add('current-player');
            }
            
            item.innerHTML = `
                <span>${index + 1}. ${player.username}</span>
                <span>${player.score}</span>
            `;
            
            content.appendChild(item);
        });
    }

    startGameLoop() {
        const gameLoop = () => {
            if (this.elements.gamePage.classList.contains('active')) {
                this.drawGame();
                requestAnimationFrame(gameLoop);
            }
        };
        gameLoop();
    }

    drawGame() {
        if (!this.gameState || !this.ctx) return;

        const ctx = this.ctx;
        const canvas = this.canvas;
        
        // Clear canvas
        ctx.fillStyle = '#0f3460';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid (optional)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        
        for (let x = 0; x <= 40; x++) {
            ctx.beginPath();
            ctx.moveTo(x * this.gridSize, 0);
            ctx.lineTo(x * this.gridSize, canvas.height);
            ctx.stroke();
        }
        
        for (let y = 0; y <= 30; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * this.gridSize);
            ctx.lineTo(canvas.width, y * this.gridSize);
            ctx.stroke();
        }
        
        // Draw food
        if (this.gameState.foods) {
            this.gameState.foods.forEach(food => {
                ctx.fillStyle = food.type === 'golden' ? '#FFD700' : '#FF4757';
                const [x, y] = food.position;
                ctx.beginPath();
                ctx.arc(
                    x * this.gridSize + this.gridSize / 2,
                    y * this.gridSize + this.gridSize / 2,
                    this.gridSize / 3,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
                
                // Add glow effect for golden food
                if (food.type === 'golden') {
                    ctx.shadowColor = '#FFD700';
                    ctx.shadowBlur = 10;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            });
        }
        
        // Draw snakes
        if (this.gameState.players) {
            Object.values(this.gameState.players).forEach(player => {
                if (!player.body || player.body.length === 0) return;
                
                // Draw snake body
                ctx.fillStyle = player.color || '#4dff91';
                
                player.body.forEach((segment, index) => {
                    const [x, y] = segment;
                    
                    if (index === 0) {
                        // Draw head
                        ctx.fillStyle = player.color || '#00ff88';
                        ctx.fillRect(
                            x * this.gridSize,
                            y * this.gridSize,
                            this.gridSize,
                            this.gridSize
                        );
                        
                        // Draw eyes
                        ctx.fillStyle = '#000';
                        const eyeSize = this.gridSize / 5;
                        
                        // Calculate eye positions based on direction
                        let eyeOffsetX = 0;
                        let eyeOffsetY = 0;
                        
                        if (player.direction === 'RIGHT') {
                            eyeOffsetX = this.gridSize - eyeSize - 2;
                            eyeOffsetY = this.gridSize / 3;
                        } else if (player.direction === 'LEFT') {
                            eyeOffsetX = 2;
                            eyeOffsetY = this.gridSize / 3;
                        } else if (player.direction === 'UP') {
                            eyeOffsetX = this.gridSize / 3;
                            eyeOffsetY = 2;
                        } else if (player.direction === 'DOWN') {
                            eyeOffsetX = this.gridSize / 3;
                            eyeOffsetY = this.gridSize - eyeSize - 2;
                        }
                        
                        ctx.fillRect(
                            x * this.gridSize + eyeOffsetX,
                            y * this.gridSize + eyeOffsetY,
                            eyeSize,
                            eyeSize
                        );
                        
                        // Draw second eye
                        if (player.direction === 'RIGHT' || player.direction === 'LEFT') {
                            ctx.fillRect(
                                x * this.gridSize + eyeOffsetX,
                                y * this.gridSize + this.gridSize - eyeSize - eyeOffsetY,
                                eyeSize,
                                eyeSize
                            );
                        } else {
                            ctx.fillRect(
                                x * this.gridSize + this.gridSize - eyeSize - eyeOffsetX,
                                y * this.gridSize + eyeOffsetY,
                                eyeSize,
                                eyeSize
                            );
                        }
                        
                        // Draw player name
                        ctx.fillStyle = '#fff';
                        ctx.font = '12px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText(
                            player.username,
                            x * this.gridSize + this.gridSize / 2,
                            y * this.gridSize - 5
                        );
                    } else {
                        // Draw body segment
                        ctx.fillStyle = player.color || '#4dff91';
                        ctx.fillRect(
                            x * this.gridSize,
                            y * this.gridSize,
                            this.gridSize,
                            this.gridSize
                        );
                        
                        // Add rounded corners
                        ctx.fillStyle = player.color ? this.darkenColor(player.color, 20) : '#00cc66';
                        const cornerSize = this.gridSize / 4;
                        ctx.fillRect(x * this.gridSize, y * this.gridSize, cornerSize, cornerSize);
                        ctx.fillRect(x * this.gridSize + this.gridSize - cornerSize, y * this.gridSize, cornerSize, cornerSize);
                        ctx.fillRect(x * this.gridSize, y * this.gridSize + this.gridSize - cornerSize, cornerSize, cornerSize);
                        ctx.fillRect(x * this.gridSize + this.gridSize - cornerSize, y * this.gridSize + this.gridSize - cornerSize, cornerSize, cornerSize);
                    }
                });
                
                // If snake is dead, draw skull
                if (!player.alive && player.body.length > 0) {
                    const [x, y] = player.body[0];
                    ctx.fillStyle = '#fff';
                    ctx.font = '20px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(
                        '💀',
                        x * this.gridSize + this.gridSize / 2,
                        y * this.gridSize + this.gridSize / 2 + 7
                    );
                }
            });
        }
    }

    darkenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        
        return "#" + (
            0x1000000 +
            (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)
        ).toString(16).slice(1);
    }

    getSkinColor(skin) {
        const colors = {
            'default': '#4dff91',
            'green': '#00ff00',
            'blue': '#0099ff',
            'red': '#ff4757',
            'purple': '#9d4edd',
            'orange': '#ff9900',
            'pink': '#ff66cc',
            'gold': '#ffd700'
        };
        return colors[skin] || '#4dff91';
    }

    async loadShopSkins() {
        if (!this.user) return;
        
        this.elements.shopCoins.textContent = this.user.total_coins;
        
        const skins = [
            { id: 'green', name: 'Green Snake', price: 100, color: '#00ff00' },
            { id: 'blue', name: 'Blue Snake', price: 150, color: '#0099ff' },
            { id: 'red', name: 'Red Snake', price: 200, color: '#ff4757' },
            { id: 'purple', name: 'Purple Snake', price: 300, color: '#9d4edd' },
            { id: 'orange', name: 'Orange Snake', price: 400, color: '#ff9900' },
            { id: 'pink', name: 'Pink Snake', price: 500, color: '#ff66cc' },
            { id: 'gold', name: 'Golden Snake', price: 1000, color: '#ffd700' }
        ];
        
        this.elements.skinsContainer.innerHTML = '';
        
        skins.forEach(skin => {
            const owned = this.user.owned_skins.includes(skin.id);
            const selected = this.user.current_skin === skin.id;
            
            const skinCard = document.createElement('div');
            skinCard.className = 'skin-card';
            if (selected) skinCard.classList.add('selected');
            if (owned) skinCard.classList.add('owned');
            
            skinCard.innerHTML = `
                <div class="skin-preview" style="background: ${skin.color};">
                    <i class="fas fa-snake"></i>
                </div>
                <h4>${skin.name}</h4>
                ${owned ? 
                    `<p class="skin-owned">✓ Owned</p>` : 
                    `<p class="skin-price"><i class="fas fa-coins"></i> ${skin.price}</p>`
                }
            `;
            
            skinCard.addEventListener('click', () => {
                if (owned) {
                    this.selectSkin(skin.id);
                } else {
                    this.buySkin(skin.id, skin.price);
                }
            });
            
            this.elements.skinsContainer.appendChild(skinCard);
        });
    }

    async buySkin(skinId, price) {
        if (!this.user || this.user.total_coins < price) {
            alert('Not enough coins!');
            return;
        }
        
        try {
            const response = await fetch('/buy_skin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: `skin_id=${skinId}&price=${price}`
            });
            
            if (response.ok) {
                // Update user data
                const userResponse = await fetch('/users/me', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                
                if (userResponse.ok) {
                    this.user = await userResponse.json();
                    this.updateUserDisplay();
                    this.loadShopSkins();
                    this.playCoinSound();
                }
            } else {
                const error = await response.json();
                alert(error.detail || 'Purchase failed');
            }
        } catch (error) {
            console.error('Buy skin error:', error);
            alert('Connection error. Please try again.');
        }
    }

    async selectSkin(skinId) {
        try {
            const response = await fetch('/select_skin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: `skin_id=${skinId}`
            });
            
            if (response.ok) {
                // Update user data
                const userResponse = await fetch('/users/me', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                
                if (userResponse.ok) {
                    this.user = await userResponse.json();
                    this.loadShopSkins();
                }
            }
        } catch (error) {
            console.error('Select skin error:', error);
        }
    }

    async loadGlobalLeaderboard() {
        try {
            const response = await fetch('/leaderboard?limit=20');
            if (response.ok) {
                const leaderboard = await response.json();
                this.renderGlobalLeaderboard(leaderboard);
            }
        } catch (error) {
            console.error('Load leaderboard error:', error);
        }
    }

    renderGlobalLeaderboard(leaderboard) {
        this.elements.globalLeaderboard.innerHTML = '';
        
        leaderboard.forEach((player, index) => {
            const row = document.createElement('div');
            row.className = 'leaderboard-row';
            
            row.innerHTML = `
                <div class="leaderboard-rank">${index + 1}</div>
                <div class="leaderboard-name">${player.username}</div>
                <div class="leaderboard-score">${player.total_score}</div>
            `;
            
            this.elements.globalLeaderboard.appendChild(row);
        });
    }

    leaveGame() {
        this.disconnectWebSocket();
        this.gameState = null;
        this.showMenu();
    }

    resizeCanvas() {
        if (!this.canvas) return;
        
        const container = this.canvas.parentElement;
        const containerWidth = container.clientWidth - 40; // Account for padding
        
        // Maintain aspect ratio
        const aspectRatio = this.canvas.width / this.canvas.height;
        const newHeight = containerWidth / aspectRatio;
        
        // Limit height for mobile
        const maxHeight = window.innerHeight * 0.6;
        const finalHeight = Math.min(newHeight, maxHeight);
        const finalWidth = finalHeight * aspectRatio;
        
        this.canvas.style.width = finalWidth + 'px';
        this.canvas.style.height = finalHeight + 'px';
    }

    playCoinSound() {
        if (this.elements.coinSound) {
            this.elements.coinSound.currentTime = 0;
            this.elements.coinSound.play().catch(e => console.log('Audio play failed:', e));
        }
    }

    playEatSound() {
        if (this.elements.eatSound) {
            this.elements.eatSound.currentTime = 0;
            this.elements.eatSound.play().catch(e => console.log('Audio play failed:', e));
        }
    }

    playDeathSound() {
        if (this.elements.deathSound) {
            this.elements.deathSound.currentTime = 0;
            this.elements.deathSound.play().catch(e => console.log('Audio play failed:', e));
        }
    }
}

// Initialize the game when page loads
window.addEventListener('DOMContentLoaded', () => {
    window.game = new SnakeMultiplayer();
});