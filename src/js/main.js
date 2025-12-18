/* eslint-disable indent */
/* eslint-disable no-undef */
class GridAnimation {
	constructor(canvas, options = {}) {
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
		this.options = {
			borderColor: options.borderColor || "rgba(255, 255, 255, 0.05)",
			direction: options.direction || "right",
			hoverFillColor: options.hoverFillColor || "rgba(255, 255, 255, 0.6)",
			hoverShadowColor: options.hoverShadowColor || "rgba(255, 255, 255, 0.3)",
			// 渐变过渡的色块数
			snakeColorDecay: options.snakeColorDecay || 0.7,
			snakeGradientStops: options.snakeGradientStops || 5,
			// 新增颜色渐变相关选项
			snakeHeadColor: options.snakeHeadColor || "rgba(255, 255, 255, 0.9)",
			snakeTailColor: options.snakeTailColor || "rgba(100, 100, 255, 0.3)",
			// 痕迹持续时间（毫秒）
			specialBlockColor: options.specialBlockColor || "rgba(255, 100, 100, 0.8)",
			specialHoverColor: options.specialHoverColor || "rgba(100, 255, 100, 0.8)",
			speed: options.speed || 1,
			squareSize: options.squareSize || 40,
			// 渐变衰减系数，越小衰减越快
			// 移动端触摸相关选项
			touchSensitivity: options.touchSensitivity || 1.0,
			// 过渡时间（毫秒）
			trailDuration: options.trailDuration || 1000,
			transitionDuration: options.transitionDuration || 200, // 触摸灵敏度
			vibrationEnabled: options.vibrationEnabled || false, // 是否启用震动反馈
			...options
		};

		this.gridOffset = { x: 0, y: 0 };
		this.hoveredSquare = null;
		this.animationFrame = null;
		this.currentOpacity = 0;
		this.targetOpacity = 0;
		this.lastTimestamp = 0;
		this.hoverRadius = 3;
		this.trailSquares = new Map(); // 存储痕迹格子的信息
		this.specialBlock = null;
		this.specialBlockTimer = null;
		this.isSpecialBlockHovered = false;
		this.snakeBody = []; // 存储蛇身的数组
		this.shouldGrow = false; // 控制蛇身是否增长
	}
	init() {
		this.resizeCanvas();
		this.setupEventListeners();

		// 移动端性能优化
		if (window.isPhone) {
			this.optimizeForMobile();
		}

		this.animate();

		// 在移动设备上延迟创建食物，确保画布大小计算正确
		if (window.isPhone) {
			setTimeout(() => {
				this.createSpecialBlock();
			}, 500);
		} else {
			this.createSpecialBlock();
		}

		// 添加页面可见性变化监听，在页面不可见时暂停动画
		document.addEventListener(
			visibilityChangeEvent,
			this.handleVisibilityChange.bind(this)
		);
	}
	optimizeForMobile() {
		// 检测设备性能, 默认高性能模式
		const canvas = this.canvas;
		const ctx = canvas.getContext("2d");

		// 简单的性能测试
		const startTime = performance.now();
		for (let i = 0; i < 1000; i++) {
			ctx.fillRect(0, 0, 1, 1);
		}
		const endTime = performance.now();
		const performanceScore = endTime - startTime;

		// 根据性能调整设置
		if (performanceScore > 10) {
			// 低性能设备
			this.options.squareSize = Math.max(this.options.squareSize * 1.5, 60);
			this.options.speed *= 0.7;
			this.options.trailDuration *= 0.5;
		} else if (performanceScore > 5) {
			// 中等性能设备
			this.options.squareSize = Math.max(this.options.squareSize * 1.2, 50);
			this.options.speed *= 0.8;
		}
	}
	resizeCanvas() {
		// 处理设备像素比，确保在高DPR设备上（如iPhone）清晰渲染
		const dpr = window.devicePixelRatio || 1;
		const displayWidth = this.canvas.offsetWidth;
		const displayHeight = this.canvas.offsetHeight;

		// 设置画布大小为实际像素大小
		this.canvas.width = Math.floor(displayWidth * dpr);
		this.canvas.height = Math.floor(displayHeight * dpr);

		// 设置CSS尺寸为显示尺寸
		this.canvas.style.width = `${displayWidth}px`;
		this.canvas.style.height = `${displayHeight}px`;

		// 缩放上下文以匹配设备像素比
		this.ctx.scale(dpr, dpr);
	}
	setupEventListeners() {
		window.addEventListener("resize", () => this.resizeCanvas());
		this.canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e));
		this.canvas.addEventListener("mouseleave", () => this.handleMouseLeave());

		// 移动端触摸事件处理
		if (window.isPhone) {
			this.setupTouchEvents();
		}

		// 监听设备方向变化，重新创建食物
		if (window.isPhone && window.orientation !== undefined) {
			window.addEventListener("orientationchange", () => {
				setTimeout(() => {
					this.resizeCanvas();
					this.createSpecialBlock();
				}, 300);
			});
		}
	}
	setupTouchEvents() {
		let touchStartPos = null;
		let touchMovePos = null;
		let isTouching = false;
		let lastTouchTime = 0;
		let touchCount = 0;

		// 保存事件处理函数引用以便后续移除
		this.handleTouchStart = (e) => {
			e.preventDefault();
			const now = Date.now();

			// 防止过于频繁的触摸事件
			if (now - lastTouchTime < 16) {
				// 约60fps限制
				return;
			}
			lastTouchTime = now;

			if (e.touches.length === 1) {
				const touch = e.touches[0];
				const rect = this.canvas.getBoundingClientRect();
				touchStartPos = {
					time: now,
					x: touch.clientX - rect.left,
					y: touch.clientY - rect.top
				};
				isTouching = true;
				touchCount++;

				// 立即处理触摸开始位置
				this.handleTouchMove(touchStartPos.x, touchStartPos.y);

				// 如果之前没有蛇头，设置目标透明度
				if (!this.hoveredSquare) {
					this.targetOpacity = 0.8 * this.options.touchSensitivity;
				}

				// 添加触摸开始时的视觉反馈
				if (this.options.vibrationEnabled && navigator.vibrate) {
					navigator.vibrate(10); // 轻微震动反馈
				}
			}
		};

		this.handleTouchMoveEvent = (e) => {
			e.preventDefault();
			if (isTouching && e.touches.length === 1) {
				const touch = e.touches[0];
				const rect = this.canvas.getBoundingClientRect();
				touchMovePos = {
					x: touch.clientX - rect.left,
					y: touch.clientY - rect.top
				};

				// 处理触摸移动
				this.handleTouchMove(touchMovePos.x, touchMovePos.y);
			}
		};

		this.handleTouchEndEvent = (e) => {
			e.preventDefault();
			const now = Date.now();

			// 检测双击手势
			if (touchStartPos && now - touchStartPos.time < 300) {
				touchCount++;
				if (touchCount === 2) {
					// 双击重置蛇身
					this.resetSnake();
					touchCount = 0;

					// 双击震动反馈
					if (this.options.vibrationEnabled && navigator.vibrate) {
						navigator.vibrate([50, 50, 50]); // 三次短震动
					}
					return;
				}
			} else {
				touchCount = 0;
			}

			isTouching = false;
			touchStartPos = null;
			touchMovePos = null;

			// 触摸结束时添加痕迹
			this.handleTouchEnd();
		};

		this.handleTouchCancel = (e) => {
			e.preventDefault();
			isTouching = false;
			touchStartPos = null;
			touchMovePos = null;
		};

		// 添加事件监听器
		this.canvas.addEventListener("touchstart", this.handleTouchStart, {
			passive: false
		});
		this.canvas.addEventListener("touchmove", this.handleTouchMoveEvent, {
			passive: false
		});
		this.canvas.addEventListener("touchend", this.handleTouchEndEvent, {
			passive: false
		});
		this.canvas.addEventListener("touchcancel", this.handleTouchCancel, {
			passive: false
		});
	}
	handleTouchMove(x, y) {
		const startX
			= Math.floor(this.gridOffset.x / this.options.squareSize)
			* this.options.squareSize;
		const startY
			= Math.floor(this.gridOffset.y / this.options.squareSize)
			* this.options.squareSize;

		const hoveredSquareX = Math.floor(
			(x + this.gridOffset.x - startX) / this.options.squareSize
		);
		const hoveredSquareY = Math.floor(
			(y + this.gridOffset.y - startY) / this.options.squareSize
		);

		if (
			this.hoveredSquare?.x !== hoveredSquareX
			|| this.hoveredSquare?.y !== hoveredSquareY
		) {
			// 将当前悬停的格子添加到蛇身
			if (this.hoveredSquare) {
				this.snakeBody.unshift({
					x: this.hoveredSquare.x,
					y: this.hoveredSquare.y
				});

				// 如果没有吃到食物，移除蛇尾
				if (!this.shouldGrow && this.snakeBody.length > 0) {
					this.snakeBody.pop();
				}
				this.shouldGrow = false;
			}

			this.hoveredSquare = { x: hoveredSquareX, y: hoveredSquareY };
			// 当用户正在触摸时，设置较高的透明度
			this.targetOpacity = 0.8 * this.options.touchSensitivity;

			// 检查是否吃到食物
			if (
				this.specialBlock
				&& hoveredSquareX === this.specialBlock.x
				&& hoveredSquareY === this.specialBlock.y
			) {
				this.shouldGrow = true;
				this.createSpecialBlock();

				// 移动端吃到食物时的触觉反馈
				if (this.options.vibrationEnabled && navigator.vibrate) {
					navigator.vibrate(100);
				}
			}
		}
	}
	handleTouchEnd() {
		if (this.hoveredSquare) {
			// 将当前悬停的格子添加到蛇身
			this.snakeBody.unshift({
				x: this.hoveredSquare.x,
				y: this.hoveredSquare.y
			});

			// 如果没有吃到食物，移除蛇尾
			if (!this.shouldGrow && this.snakeBody.length > 0) {
				this.snakeBody.pop();
			}
			this.shouldGrow = false;

			const startX
				= Math.floor(this.gridOffset.x / this.options.squareSize)
				* this.options.squareSize;
			const startY
				= Math.floor(this.gridOffset.y / this.options.squareSize)
				* this.options.squareSize;
			const key = `${this.hoveredSquare.x},${this.hoveredSquare.y}`;
			this.trailSquares.set(key, {
				opacity: 0.8,
				x: this.hoveredSquare.x * this.options.squareSize + startX,
				y: this.hoveredSquare.y * this.options.squareSize + startY
			});
		}

		// 保持蛇身状态，不重置 hoveredSquare
		// 但降低透明度以显示触摸已结束
		if (this.hoveredSquare) {
			this.targetOpacity = 0.4; // 保持较低的透明度显示蛇头位置
		}
	}
	resetSnake() {
		// 重置蛇身
		this.snakeBody = [];
		this.hoveredSquare = null;
		this.targetOpacity = 0;

		// 清除所有痕迹
		this.trailSquares.clear();

		// 重新创建食物
		this.createSpecialBlock();

		// 添加重置的视觉反馈
		if (this.options.vibrationEnabled && navigator.vibrate) {
			navigator.vibrate(200); // 长震动表示重置
		}
	}
	handleMouseMove(event) {
		const rect = this.canvas.getBoundingClientRect();
		const mouseX = event.clientX - rect.left;
		const mouseY = event.clientY - rect.top;

		const startX
			= Math.floor(this.gridOffset.x / this.options.squareSize)
			* this.options.squareSize;
		const startY
			= Math.floor(this.gridOffset.y / this.options.squareSize)
			* this.options.squareSize;

		const hoveredSquareX = Math.floor(
			(mouseX + this.gridOffset.x - startX) / this.options.squareSize
		);
		const hoveredSquareY = Math.floor(
			(mouseY + this.gridOffset.y - startY) / this.options.squareSize
		);

		if (
			this.hoveredSquare?.x !== hoveredSquareX
			|| this.hoveredSquare?.y !== hoveredSquareY
		) {
			// 将当前悬停的格子添加到蛇身
			if (this.hoveredSquare) {
				this.snakeBody.unshift({
					x: this.hoveredSquare.x,
					y: this.hoveredSquare.y
				});

				// 如果没有吃到食物，移除蛇尾
				if (!this.shouldGrow && this.snakeBody.length > 0) {
					this.snakeBody.pop();
				}
				this.shouldGrow = false;
			}

			this.hoveredSquare = { x: hoveredSquareX, y: hoveredSquareY };
			this.targetOpacity = 0.6;

			// 检查是否吃到食物
			if (
				this.specialBlock
				&& hoveredSquareX === this.specialBlock.x
				&& hoveredSquareY === this.specialBlock.y
			) {
				this.shouldGrow = true; // 标记蛇身需要增长
				this.createSpecialBlock(); // 吃到食物时立即生成新的食物
			}
		}
	}
	handleMouseLeave() {
		if (this.hoveredSquare) {
			const startX
				= Math.floor(this.gridOffset.x / this.options.squareSize)
				* this.options.squareSize;
			const startY
				= Math.floor(this.gridOffset.y / this.options.squareSize)
				* this.options.squareSize;
			const key = `${this.hoveredSquare.x},${this.hoveredSquare.y}`;
			this.trailSquares.set(key, {
				opacity: 0.6,
				x: this.hoveredSquare.x * this.options.squareSize + startX,
				y: this.hoveredSquare.y * this.options.squareSize + startY
			});
		}
		this.hoveredSquare = null;
		this.targetOpacity = 0;
	}
	createSpecialBlock() {
		// 清除之前的定时器
		if (this.specialBlockTimer) {
			clearTimeout(this.specialBlockTimer);
		}

		// 获取设备像素比
		const dpr = window.devicePixelRatio || 1;

		// 随机生成特殊方块的位置
		const numSquaresX = Math.ceil(
			this.canvas.width / dpr / this.options.squareSize
		);
		const numSquaresY = Math.ceil(
			this.canvas.height / dpr / this.options.squareSize
		);

		// 确保食物不会生成在蛇身上和边缘
		let newX, newY;
		do {
			// 避开边缘，留出1格的空间
			newX = 1 + Math.floor(Math.random() * (numSquaresX - 2));
			newY = 1 + Math.floor(Math.random() * (numSquaresY - 2));
		} while (
			this.snakeBody.some((segment) => segment.x === newX && segment.y === newY)
		);

		this.specialBlock = {
			color: this.options.specialBlockColor,
			initialOffset: { ...this.gridOffset },
			x: newX,
			y: newY
		};
	}
	drawGrid() {
		const dpr = window.devicePixelRatio || 1;

		// 清除前重置变换
		this.ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		// 应用DPR比例
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		const startX
			= Math.floor(this.gridOffset.x / this.options.squareSize)
			* this.options.squareSize;
		const startY
			= Math.floor(this.gridOffset.y / this.options.squareSize)
			* this.options.squareSize;

		// 增加边框线宽度，特别是在iOS设备上
		this.ctx.lineWidth = window.isPhone ? 1.0 : 0.5;

		// 为iOS设备优化渲染，避免边框闪烁
		if (window.isPhone) {
			this.ctx.translate(0.5, 0.5); // 在iOS上对齐像素
		}

		// 绘制蛇身
		this.snakeBody.forEach((segment, index) => {
			const squareX = Math.round(
				segment.x * this.options.squareSize
					+ startX
					- (this.gridOffset.x % this.options.squareSize)
			);
			const squareY = Math.round(
				segment.y * this.options.squareSize
					+ startY
					- (this.gridOffset.y % this.options.squareSize)
			);

			this.ctx.shadowColor = this.options.hoverShadowColor;
			this.ctx.shadowBlur = 15;
			this.ctx.shadowOffsetX = 0;
			this.ctx.shadowOffsetY = 0;

			// 计算蛇身颜色渐变
			if (index === 0) {
				// 蛇头使用特殊颜色
				this.ctx.fillStyle = this.options.snakeHeadColor;
			} else {
				// 计算渐变系数
				const gradientFactor = Math.pow(this.options.snakeColorDecay, index);

				// 解析头部和尾部颜色
				const headColorMatch = this.options.snakeHeadColor.match(
					/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([.\d]+))?\)/
				);
				const tailColorMatch = this.options.snakeTailColor.match(
					/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([.\d]+))?\)/
				);

				if (headColorMatch && tailColorMatch) {
					const headR = parseInt(headColorMatch[1]);
					const headG = parseInt(headColorMatch[2]);
					const headB = parseInt(headColorMatch[3]);
					const headA = headColorMatch[4] ? parseFloat(headColorMatch[4]) : 1;

					const tailR = parseInt(tailColorMatch[1]);
					const tailG = parseInt(tailColorMatch[2]);
					const tailB = parseInt(tailColorMatch[3]);
					const tailA = tailColorMatch[4] ? parseFloat(tailColorMatch[4]) : 1;

					// 计算中间渐变色
					const r = Math.round(headR + (tailR - headR) * (1 - gradientFactor));
					const g = Math.round(headG + (tailG - headG) * (1 - gradientFactor));
					const b = Math.round(headB + (tailB - headB) * (1 - gradientFactor));
					const a = headA + (tailA - headA) * (1 - gradientFactor);

					this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
				} else {
					// 回退到简单透明度渐变
					const opacity = Math.max(0.2, gradientFactor);
					this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
				}
			}

			this.ctx.fillRect(
				squareX,
				squareY,
				this.options.squareSize,
				this.options.squareSize
			);

			this.ctx.shadowColor = "transparent";
			this.ctx.shadowBlur = 0;
		});

		// 绘制当前悬停的格子和食物
		for (
			let x = startX;
			x < this.canvas.width + this.options.squareSize;
			x += this.options.squareSize
		) {
			for (
				let y = startY;
				y < this.canvas.height + this.options.squareSize;
				y += this.options.squareSize
			) {
				const squareX = Math.round(
					x - (this.gridOffset.x % this.options.squareSize)
				);
				const squareY = Math.round(
					y - (this.gridOffset.y % this.options.squareSize)
				);
				const gridX = Math.floor((x - startX) / this.options.squareSize);
				const gridY = Math.floor((y - startY) / this.options.squareSize);

				// 绘制食物
				if (
					this.specialBlock
					&& gridX === this.specialBlock.x
					&& gridY === this.specialBlock.y
				) {
					this.ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
					this.ctx.shadowBlur = 20;
					this.ctx.fillStyle = this.specialBlock.color;
					this.ctx.fillRect(
						squareX,
						squareY,
						this.options.squareSize,
						this.options.squareSize
					);
					this.ctx.shadowColor = "transparent";
					this.ctx.shadowBlur = 0;
				}

				// 绘制当前悬停的格子（蛇头）
				if (
					this.hoveredSquare
					&& gridX === this.hoveredSquare.x
					&& gridY === this.hoveredSquare.y
				) {
					this.ctx.shadowColor = this.options.hoverShadowColor;
					this.ctx.shadowBlur = 15;
					this.ctx.shadowOffsetX = 0;
					this.ctx.shadowOffsetY = 0;

					const color = this.options.hoverFillColor.replace(
						"0.6",
						this.currentOpacity.toString()
					);
					this.ctx.fillStyle = color;
					this.ctx.fillRect(
						squareX,
						squareY,
						this.options.squareSize,
						this.options.squareSize
					);

					this.ctx.shadowColor = "transparent";
					this.ctx.shadowBlur = 0;
				}

				this.ctx.strokeStyle = this.options.borderColor;
				this.ctx.strokeRect(
					squareX,
					squareY,
					this.options.squareSize,
					this.options.squareSize
				);
			}
		}

		// 移动设备上重置坐标变换
		if (window.isPhone) {
			this.ctx.translate(-0.5, -0.5);
		}

		// 创建径向渐变来实现暗角效果
		const gradient = this.ctx.createRadialGradient(
			this.canvas.width / dpr / 2,
			this.canvas.height / dpr / 2,
			0,
			this.canvas.width / dpr / 2,
			this.canvas.height / dpr / 2,
			Math.sqrt(
				Math.pow(this.canvas.width / dpr, 2)
					+ Math.pow(this.canvas.height / dpr, 2)
			) / 2
		);
		gradient.addColorStop(0, "rgba(6, 6, 6, 0)");
		gradient.addColorStop(1, "#060606");

		this.ctx.fillStyle = gradient;
		this.ctx.fillRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
	}
	updateAnimation(timestamp) {
		if (!this.lastTimestamp) {
			this.lastTimestamp = timestamp;
		}

		const deltaTime = timestamp - this.lastTimestamp;
		this.lastTimestamp = timestamp;

		// 更新透明度
		if (this.currentOpacity !== this.targetOpacity) {
			const progress = Math.min(deltaTime / this.options.transitionDuration, 1);
			this.currentOpacity
				= this.currentOpacity
				+ (this.targetOpacity - this.currentOpacity) * progress;
		}

		// 更新痕迹格子的透明度
		for (const [key, square] of this.trailSquares) {
			square.opacity -= deltaTime / this.options.trailDuration;
			if (square.opacity <= 0) {
				this.trailSquares.delete(key);
			}
		}

		// 获取设备像素比
		const dpr = window.devicePixelRatio || 1;

		// 更新网格位置，为移动设备降低速度以减少闪烁
		const effectiveSpeed = Math.max(
			window.isPhone ? this.options.speed * 0.8 : this.options.speed,
			0
		);

		// 确保移动位置为整数值来避免子像素渲染导致的闪烁
		const moveAmount = window.isPhone
			? Math.round(effectiveSpeed * 100) / 100
			: effectiveSpeed;

		switch (this.options.direction) {
			case "right":
				this.gridOffset.x
					= (this.gridOffset.x - moveAmount + this.options.squareSize)
					% this.options.squareSize;
				break;
			case "left":
				this.gridOffset.x
					= (this.gridOffset.x + moveAmount + this.options.squareSize)
					% this.options.squareSize;
				break;
			case "up":
				this.gridOffset.y
					= (this.gridOffset.y + moveAmount + this.options.squareSize)
					% this.options.squareSize;
				break;
			case "down":
				this.gridOffset.y
					= (this.gridOffset.y - moveAmount + this.options.squareSize)
					% this.options.squareSize;
				break;
			case "diagonal":
				this.gridOffset.x
					= (this.gridOffset.x - moveAmount + this.options.squareSize)
					% this.options.squareSize;
				this.gridOffset.y
					= (this.gridOffset.y - moveAmount + this.options.squareSize)
					% this.options.squareSize;
				break;
		}

		// 检查食物是否移出屏幕
		if (this.specialBlock) {
			const startX
				= Math.floor(this.gridOffset.x / this.options.squareSize)
				* this.options.squareSize;
			const startY
				= Math.floor(this.gridOffset.y / this.options.squareSize)
				* this.options.squareSize;
			const foodX = Math.round(
				this.specialBlock.x * this.options.squareSize
					+ startX
					- (this.gridOffset.x % this.options.squareSize)
			);
			const foodY = Math.round(
				this.specialBlock.y * this.options.squareSize
					+ startY
					- (this.gridOffset.y % this.options.squareSize)
			);

			// 调整适用于设备像素比的边界检查
			if (
				foodX < -this.options.squareSize
				|| foodX > this.canvas.width / dpr
				|| foodY < -this.options.squareSize
				|| foodY > this.canvas.height / dpr
			) {
				// 食物移出屏幕时生成新的食物
				this.createSpecialBlock();
			}
		}

		this.drawGrid();
		this.animationFrame = requestAnimationFrame((timestamp) =>
			this.updateAnimation(timestamp)
		);
	}
	animate() {
		this.animationFrame = requestAnimationFrame((timestamp) =>
			this.updateAnimation(timestamp)
		);
	}
	handleVisibilityChange() {
		if (document[hiddenProperty]) {
			// 页面不可见时暂停动画
			if (this.animationFrame) {
				cancelAnimationFrame(this.animationFrame);
				this.animationFrame = null;
			}
		} else {
			// 页面重新可见时恢复动画
			if (!this.animationFrame) {
				this.lastTimestamp = 0; // 重置时间戳以防止大幅度更新
				this.animate();
			}
		}
	}
	destroy() {
		if (this.animationFrame) {
			cancelAnimationFrame(this.animationFrame);
		}
		window.removeEventListener("resize", () => this.resizeCanvas());
		this.canvas.removeEventListener("mousemove", (e) =>
			this.handleMouseMove(e)
		);
		this.canvas.removeEventListener("mouseleave", () =>
			this.handleMouseLeave()
		);

		// 移除触摸事件监听器
		if (window.isPhone && this.handleTouchStart) {
			this.canvas.removeEventListener("touchstart", this.handleTouchStart);
			this.canvas.removeEventListener("touchmove", this.handleTouchMoveEvent);
			this.canvas.removeEventListener("touchend", this.handleTouchEndEvent);
			this.canvas.removeEventListener("touchcancel", this.handleTouchCancel);
		}

		document.removeEventListener(
			visibilityChangeEvent,
			this.handleVisibilityChange.bind(this)
		);

		// 移除方向变化监听
		if (window.isPhone && window.orientation !== undefined) {
			window.removeEventListener("orientationchange", () => { /* empty arrow function */ });
		}
	}
}

window.hiddenProperty
	= "hidden" in document
		? "hidden"
		: "webkitHidden" in document
			? "webkitHidden"
			: "mozHidden" in document
				? "mozHidden"
				: null;

window.DIRECTIONS = {
	DOWN: "DOWN",
	LEFT: "LEFT",
	RIGHT: "RIGHT",
	UNDIRECTED: "UNDIRECTED",
	UP: "UP"
};
window.isPhone
	= /Mobile|Android|iOS|iPhone|iPad|iPod|Windows Phone|KFAPWI/i.test(
		navigator.userAgent
	);

function getMoveDirection(startx, starty, endx, endy) {
	if (!window.isPhone) {
		return;
	}

	const angx = endx - startx;
	const angy = endy - starty;

	// 计算滑动距离
	const distance = Math.sqrt(angx * angx + angy * angy);

	// 最小滑动距离阈值（像素）
	const minDistance = 30;

	if (distance < minDistance) {
		return window.DIRECTIONS.UNDIRECTED;
	}

	const getAngle = (angx, angy) => (Math.atan2(angy, angx) * 180) / Math.PI;

	const angle = getAngle(angx, angy);

	// 扩大角度范围，使滑动更容易被识别
	if (angle >= -150 && angle <= -30) {
		return window.DIRECTIONS.UP;
	} else if (angle > 30 && angle < 150) {
		return window.DIRECTIONS.DOWN;
	} else if (
		(angle >= 120 && angle <= 180)
		|| (angle >= -180 && angle < -120)
	) {
		return window.DIRECTIONS.LEFT;
	} else if (angle >= -60 && angle <= 60) {
		return window.DIRECTIONS.RIGHT;
	}

	return window.DIRECTIONS.UNDIRECTED;
}

function loadIntro() {
	if (document[hiddenProperty] || loadIntro.loaded) {
		return;
	}

	setTimeout(() => {
		$(".wrap").classList.add("in");
		setTimeout(() => {
			$(".content-subtitle").innerHTML = `<span>${[...subtitle].join(
				"</span><span>"
			)}</span>`;
		}, 270);
	}, 0);
	loadIntro.loaded = true;
}

function switchToMain() {
	if (switchToMain.switched) {
		return;
	}
	const DOM = {
		intro: $(".content-intro"),
		path: $(".shape-wrap path"),
		shape: $("svg.shape")
	};
	DOM.shape.style.transformOrigin = "50% 0%";

	anime({
		duration: 1100,
		easing: "easeInOutSine",
		targets: DOM.intro,
		translateY: "-200vh"
	});

	anime({
		scaleY: [
			{
				duration: 550,
				easing: "easeInQuad",
				value: [0.8, 1.8]
			},
			{
				duration: 550,
				easing: "easeOutQuad",
				value: 1
			}
		],
		targets: DOM.shape
	});
	anime({
		d: DOM.path.getAttribute("pathdata:id"),
		duration: 1100,
		easing: "easeOutQuad",
		targets: DOM.path
	});

	switchToMain.switched = true;
	window.currentPage = "main";
}

function switchToIntro() {
	if (!switchToMain.switched) {
		return;
	}

	const DOM = {
		intro: $(".content-intro"),
		path: $(".shape-wrap path"),
		shape: $("svg.shape")
	};
	DOM.shape.style.transformOrigin = "50% 0%";

	// 立即显示背景画布并重新初始化，确保显示正确的初始效果
	if (window.backgroundCanvas) {
		window.backgroundCanvas.style.display = "block";

		// 立即重新初始化背景，避免显示Main页的背景状态
		if (typeof window.initBackground === "function") {
			window.initBackground.loaded = false;
			window.initBackground();
		}
	}

	// 确保背景样式正确重置
	if (document.querySelector(".content-inner")) {
		document.querySelector(".content-inner").style.background = "unset";
	}
	if (document.querySelector(".shape")) {
		document.querySelector(".shape").style.fill = "#1e1f21";
	}

	anime({
		duration: 1100,
		easing: "easeInOutSine",
		targets: DOM.intro,
		translateY: "0vh"
	});

	anime({
		scaleY: [
			{
				duration: 550,
				easing: "easeInQuad",
				value: [1, 1.8]
			},
			{
				duration: 550,
				easing: "easeOutQuad",
				value: 0.8
			}
		],
		targets: DOM.shape
	});

	anime({
		complete: function() {
			// 重置状态，允许再次切换到Main页面
			switchToMain.switched = false;
			loadAll.loaded = false;
		},
		d: "M -44,-50 C -52.71,28.52 15.86,8.186 184,14.69 383.3,22.39 462.5,12.58 638,14 835.5,15.6 987,6.4 1194,13.86 1661,30.68 1652,-36.74 1582,-140.1 1512,-243.5 15.88,-589.5 -44,-50 Z",
		duration: 1100,
		easing: "easeOutQuad",
		targets: DOM.path
	});

	window.currentPage = "intro";
}

// 兼容旧的函数名
function switchPage() {
	switchToMain();
}

function loadMain() {
	if (loadMain.loaded) {
		return;
	}
	setTimeout(() => {
		$(".card-inner").classList.add("in");
		setTimeout(() => {
			const canvas = document.getElementById("gridCanvas");
			if (canvas) {
				const gridAnimation = new GridAnimation(canvas, {
					borderColor: window.isPhone
						? "rgba(255, 255, 255, 0.2)"
						: "rgba(255, 255, 255, 0.1)",
					direction: "diagonal",
					hoverFillColor: "rgba(255, 255, 255, 0.8)",
					hoverShadowColor: "rgba(255, 255, 255, 0.8)",

					snakeColorDecay: 0.85,

					// 蛇身颜色渐变配置
					snakeHeadColor: "rgba(255, 255, 255, 0.95)",

					snakeTailColor: "rgba(218, 231, 255, 0.25)",

					// 移动端更长的痕迹
					specialBlockColor: "rgba(100, 255, 152, 0.8)",

					specialHoverColor: "rgba(29, 202, 29, 0.8)",

					speed: window.isPhone ? 0.03 : 0.05,

					squareSize: window.isPhone ? 50 : 40,

					// 颜色衰减系数
					// 移动端特殊配置
					touchSensitivity: window.isPhone ? 1.2 : 1.0,

					// 移动端更快的过渡
					trailDuration: window.isPhone ? 2000 : 1500,

					transitionDuration: window.isPhone ? 150 : 200, // 触摸灵敏度
					vibrationEnabled: window.isPhone // 是否启用震动反馈
				});
				gridAnimation.init();
			}
		}, 1100);
	}, 400);
	loadMain.loaded = true;
}

function loadAll() {
	if (loadAll.loaded) {
		return;
	}
	switchPage();
	loadMain();
	loadAll.loaded = true;
}

window.visibilityChangeEvent = hiddenProperty.replace(
	/hidden/i,
	"visibilitychange"
);
// 初始化页面状态
window.currentPage = "intro";

window.addEventListener(visibilityChangeEvent, loadIntro);
window.addEventListener("DOMContentLoaded", loadIntro);

const enterEl = $(".enter");
enterEl.addEventListener("click", loadAll);
enterEl.addEventListener("touchenter", loadAll);

function handleScrollEvent(e) {
	const deltaY = e.deltaY || e.wheelDelta * -1 || e.detail;

	if (window.currentPage === "category" && deltaY < 0) {
		// 在分类页面向上滚动，返回到main页面
		hideCategoryPage();
	} else if (window.currentPage === "main" && deltaY < 0) {
		// 在main页面向上滚动，返回到intro页面
		switchToIntro();
	} else if (deltaY > 0 && (!window.currentPage || window.currentPage === "intro")) {
		// 向下滚动，从intro页面切换到main页面
		loadAll();
	}
}

document.body.addEventListener("wheel", handleScrollEvent, { passive: true });
document.body.addEventListener("mousewheel", handleScrollEvent, {
	passive: true
});
document.body.addEventListener("DOMMouseScroll", handleScrollEvent, {
	passive: true
}); // Firefox兼容
$(".arrow").addEventListener("mouseenter", loadAll);

if (window.isPhone) {
	let touchStartPosition = null;
	let isCanvasTouch = false;

	document.addEventListener(
		"touchstart",
		function(e) {
			// 检查触摸是否发生在画布上
			const canvas = document.getElementById("gridCanvas");

			// 只有在main页面且触摸目标确实是画布时才认为是画布触摸
			// 并且需要检查触摸是否在画布的可交互区域内
			isCanvasTouch = false;
			if (canvas && window.currentPage === "main" && e.target === canvas) {
				// 进一步检查：如果用户触摸的是画布边缘区域，仍然允许页面切换
				const rect = canvas.getBoundingClientRect();
				const touchX = e.touches[0].clientX - rect.left;
				const touchY = e.touches[0].clientY - rect.top;
				const edgeThreshold = 50; // 边缘50px区域仍可用于页面切换

				// 只有触摸在画布中心区域时才认为是画布交互
				isCanvasTouch = touchX > edgeThreshold
					&& touchX < rect.width - edgeThreshold
					&& touchY > edgeThreshold
					&& touchY < rect.height - edgeThreshold;
			}

			// 如果不是画布触摸，记录起始位置用于页面切换
			if (!isCanvasTouch) {
				touchStartPosition = {
					time: Date.now(),
					x: e.touches[0].pageX,
					y: e.touches[0].pageY
				};
			}

			// 保持原有的全局变量兼容性
			window.startx = e.touches[0].pageX;
			window.starty = e.touches[0].pageY;
		},
		{ passive: true }
	);

	document.addEventListener(
		"touchend",
		function(e) {
			// 只有非画布触摸才处理页面切换
			if (!isCanvasTouch && touchStartPosition) {
				const endx = e.changedTouches[0].pageX;
				const endy = e.changedTouches[0].pageY;
				const endTime = Date.now();

				// 检查触摸时长，避免误触发
				const touchDuration = endTime - touchStartPosition.time;
				if (touchDuration > 50 && touchDuration < 1000) {
					const direction = getMoveDirection(touchStartPosition.x, touchStartPosition.y, endx, endy);

					if (direction === window.DIRECTIONS.UP && (!window.currentPage || window.currentPage === "intro")) {
						// 向上滑动，从intro页面切换到main页面
						loadAll();
					} else if (direction === window.DIRECTIONS.DOWN && window.currentPage === "main") {
						// 向下滑动，从main页面返回到intro页面
						switchToIntro();
					} else if (direction === window.DIRECTIONS.DOWN && window.currentPage === "category") {
						// 向下滑动，从分类页面返回到main页面
						switchToMain();
					}
				}
			}

			// 重置状态
			touchStartPosition = null;
			isCanvasTouch = false;
		},
		{ passive: true }
	);
}

// 分类页面相关功能
// categoryData 已在 scripts.pug 中定义

// 设置分类点击监听
function setupCategoryListeners() {
	const categoryItems = document.querySelectorAll(".category-item");

	categoryItems.forEach(item => {
		const link = item.querySelector(".category-link");
		link.addEventListener("click", function(e) {
			e.preventDefault();
			const categoryId = item.getAttribute("data-category");
			showCategoryPage(categoryId);
		});
	});
}

// 显示分类页面
function showCategoryPage(categoryId) {
	if (!window.categoryData) {
		return;
	}

	const category = window.categoryData.find(cat => cat.id === categoryId);
	if (!category) {
		return;
	}

	const categoryContent = document.querySelector(".content-category");
	const categoryTitle = document.querySelector(".category-title");
	const projectsList = document.querySelector(".category-projects-list");
	const categoryCardInner = document.querySelector(".category-card-inner");

	// 设置标题
	categoryTitle.textContent = category.text;

	// 清空并填充项目列表
	projectsList.innerHTML = "";
	category.projects.forEach(project => {
		const li = document.createElement("li");
		li.innerHTML = `
			<a href="${project.href}" aria-label="${project.text}">
				<i class="icon icon-${project.icon}"></i>
				<span>${project.text}</span>
			</a>
		`;
		projectsList.appendChild(li);
	});

	// 显示分类页面
	categoryContent.classList.add("active");
	window.currentPage = "category";

	// 延迟添加淡入动画
	setTimeout(() => {
		categoryCardInner.classList.add("in");
	}, 100);
}

// 隐藏分类页面并返回main
function hideCategoryPage() {
	const categoryContent = document.querySelector(".content-category");
	const categoryCardInner = document.querySelector(".category-card-inner");

	// 先移除淡入效果
	categoryCardInner.classList.remove("in");

	// 等待动画完成后隐藏页面
	setTimeout(() => {
		categoryContent.classList.remove("active");
		window.currentPage = "main";
	}, 600);
}

// 修改switchToMain函数，确保从分类页返回时正确处理
const originalSwitchToMain = switchToMain;
window.switchToMain = function() {
	if (window.currentPage === "category") {
		hideCategoryPage();
	} else {
		originalSwitchToMain();
	}
};

// 设置返回按钮监听
document.addEventListener("DOMContentLoaded", function() {
	const backButton = document.querySelector(".back-button");
	if (backButton) {
		backButton.addEventListener("click", function() {
			hideCategoryPage();
		});
	}

	// 延迟初始化分类监听器
	setTimeout(() => {
		setupCategoryListeners();
	}, 1500);
});