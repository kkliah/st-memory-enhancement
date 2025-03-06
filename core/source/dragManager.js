// dragManager.js
import {BASE, DERIVED, EDITOR, SYSTEM, USER} from '../manager.js';

/**
 * @description 拖拽管理器 - 用于管理拖拽操作
 */
export class Drag {
    constructor() {
        // 初始化变换参数 (保持不变)
        this.translateX = 0;
        this.translateY = 0;
        this.scale = 1;
        this.isDragging = false;
        this.accumulatedX = 0;
        this.accumulatedY = 0;
        this.threshold = 1;
        this.zoomValue = 0.9;
        this.zoomRange = [-5, 10];
        this.elements = new Map();

        // 新增阈值变量 (保持不变)
        this.dragThreshold = 10; // 移动超过10px视为拖拽
        this.initialPosition = { x: 0, y: 0 };
        this.shouldDrag = false;

        // 双指缩放相关变量 (保持不变)
        this.isPinching = false; // 标记是否正在进行双指缩放
        this.startPinchDistance = 0; // 初始双指距离
        this.startScale = 1; // 缩放开始时的 scale 值
        this.pinchCenter = { x: 0, y: 0 }; // 缩放中心点

        // 创建容器结构 (保持不变)
        this.dragContainer = document.createElement('div');
        this.dragContainer.style.position = 'relative';
        this.dragContainer.style.display = 'flex';
        this.dragContainer.style.flexGrow = '1';
        this.dragContainer.style.flexShrink = '0';
        this.dragContainer.style.width = '100%';
        this.dragContainer.style.height = '100%';
        this.dragContainer.style.minHeight = '500px';
        this.dragContainer.style.overflow = 'hidden';

        // 创建可拖动内容层 (保持不变)
        this.dragSpace = document.createElement('div');
        this.dragSpace.style.transformOrigin = '0 0';
        this.dragSpace.style.position = 'absolute';
        this.dragSpace.style.top = '0';
        this.dragSpace.style.left = '0';
        this.dragSpace.style.bottom = '0';
        if (!SYSTEM.isMobile()) {
            this.dragSpace.style.transition = 'transform 0.12s cubic-bezier(0.22, 1, 0.36, 1)';
        }
        this.dragContainer.appendChild(this.dragSpace);

        // 创建拖动事件层 (保持不变)
        this.dragLayer = document.createElement('div');
        this.dragLayer.style.position = 'absolute';
        this.dragLayer.style.top = '0';
        this.dragLayer.style.left = '0';
        this.dragLayer.style.bottom = '0';
        this.dragLayer.style.width = '100%';
        this.dragLayer.style.height = '100%';
        this.dragLayer.style.cursor = 'grab';
        this.dragLayer.style.userSelect = 'none';
        this.dragContainer.appendChild(this.dragLayer);

        // 绑定事件处理 (修改：touchstart 事件直接绑定 handleTouchStart)
        this.dragLayer.addEventListener('mousedown', this.handleMouseDown);
        this.dragLayer.addEventListener('touchstart', this.handleTouchStart);
        this.dragLayer.addEventListener('wheel', this.handleWheel, { passive: false });
        this.dragLayer.addEventListener('touchmove', this.handleTouchMove);
        this.dragLayer.addEventListener('touchend', this.handleMouseUp);
        this.dragLayer.addEventListener('touchcancel', this.handleMouseUp);
    }


    /**
     * 获取渲染元素，用于挂载到页面上 (保持不变)
     * @returns {HTMLDivElement}
     */
    get render() {
        return this.dragContainer;
    }

    /**
     * 设置样式，支持对象形式 (保持不变)
     * @param style
     * @example style({background: 'red', color: 'white'})
     */
    style(style){
        this.dragContainer.style = {...this.dragContainer.style, ...style};
    }

    /**
     * 添加元素，支持设置初始位置，默认为[0, 0] (保持不变)
     * @example add('name', element, [100, 100])
     * @param name
     * @param element
     * @param position
     */
    add(name, element, position = [0, 0]) {
        element.style.position = 'absolute';
        element.style.left = `${position[0]}px`;
        element.style.top = `${position[1]}px`;
        this.dragSpace.appendChild(element);
        this.elements.set(name, element);
    }

    /**
     * 移动元素到指定位置，默认为[0, 0] (保持不变)
     * @example move('name', [100, 100])
     * @param name
     * @param position
     */
    move(name, position = [0, 0]) {
        if (this.elements.has(name)) {
            this.elements.get(name).style.left = `${position[0]}px`;
            this.elements.get(name).style.top = `${position[1]}px`;
        }
    }

    /**
     * 删除元素，同时会从页面上移除 (保持不变)
     * @example delete('name')
     * @param name
     */
    delete(name) {
        if (this.elements.has(name)) {
            this.dragSpace.removeChild(this.elements.get(name));
            this.elements.delete(name);
        }
    }


    /** ------------------ 以下为拖拽功能实现，为事件处理函数，不需要手动调用 ------------------ */
        // 鼠标按下事件 (保持不变，只处理鼠标事件)
    handleMouseDown = (e) => {
        if (e.button === 0) { // 只处理鼠标左键
            this.initialPosition.x = e.clientX;
            this.initialPosition.y = e.clientY;

            this.dragLayer.style.pointerEvents = 'none';
            const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
            this.dragLayer.style.pointerEvents = 'auto';

            if (elementUnderMouse?.closest('button, [onclick], a')) {
                elementUnderMouse.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                return;
            }

            this.isDragging = false;
            this.shouldDrag = false;
            this.startX = e.clientX;
            this.startY = e.clientY;

            document.addEventListener('mousemove', this.handleFirstMove);
            document.addEventListener('mouseup', this.handleMouseUp);
        }
    };

    // 触摸开始事件 (修改：只处理触摸开始的初始状态，不立即触发拖拽)
    handleTouchStart = (e) => {
        if (e.touches.length === 2) {
            // 双指操作，开始缩放 (保持不变)
            this.isPinching = true;
            this.isDragging = false; // 双指缩放时，取消拖拽状态
            this.shouldDrag = false;
            this.startPinchDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            this.startScale = this.scale;

            // 计算双指中心点作为缩放中心 (保持不变)
            this.pinchCenter = {
                x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
            };
        } else if (e.touches.length === 1) {
            // 单指操作，设置初始位置，但不立即开始拖拽
            let clientX, clientY, touches;
            touches = e.touches;
            if (touches.length > 0) {
                clientX = touches[0].clientX;
                clientY = touches[0].clientY;
            } else {
                return;
            }

            this.initialPosition.x = clientX;
            this.initialPosition.y = clientY;

            this.dragLayer.style.pointerEvents = 'none';
            const elementUnderMouse = document.elementFromPoint(clientX, clientY);
            this.dragLayer.style.pointerEvents = 'auto';

            if (elementUnderMouse?.closest('button, [onclick], a')) {
                elementUnderMouse.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                return;
            }

            this.isDragging = false;
            this.shouldDrag = false;
            this.startX = clientX;
            this.startY = clientY;

            // 添加 touchmove 和 touchend 监听器，注意这里是添加到 document 上 (关键修改)
            document.addEventListener('touchmove', this.handleFirstMove); // 统一在 handleFirstMove 中处理首次移动判断
            document.addEventListener('touchend', this.handleMouseUp);
        }
    }

    // 首次移动事件处理 (修改：统一处理鼠标和触摸的首次移动)
    handleFirstMove = (e) => {
        let clientX, clientY;
        if (e.type === 'touchmove') { // 触摸事件
            if (e.touches.length !== 1) return; // 只处理单指触摸移动
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if (e.type === 'mousemove') { // 鼠标事件
            clientX = e.clientX;
            clientY = e.clientY;
        } else {
            return; // 其他事件类型不处理
        }

        const dx = clientX - this.initialPosition.x;
        const dy = clientY - this.initialPosition.y;

        if (Math.sqrt(dx * dx + dy * dy) > this.dragThreshold) {
            this.isDragging = true;
            this.shouldDrag = true;
            this.dragLayer.style.cursor = 'grabbing';

            this.canvasStartX = (this.startX - this.translateX) / this.scale;
            this.canvasStartY = (this.startY - this.translateY) / this.scale;

            // 移除 handleFirstMove 监听器，添加 handleMouseMove 监听器 (保持不变)
            document.removeEventListener('mousemove', this.handleFirstMove);
            document.addEventListener('mousemove', this.handleMouseMove);
            document.removeEventListener('touchmove', this.handleFirstMove); // 移除 touchmove 的 handleFirstMove 监听
            document.addEventListener('touchmove', this.handleMouseMove); // 添加 touchmove 的 handleMouseMove 监听
            this.handleMouseMove(e); // 立即执行一次 handleMouseMove，应用首次移动
        }
    };

    // 鼠标移动事件 (保持不变，同时处理鼠标和触摸移动)
    handleMouseMove = (e) => {
        if (!this.isDragging) return;

        let clientX, clientY;
        if (e.type === 'touchmove') { // 触摸事件
            if (e.touches.length !== 1) return; // 只处理单指触摸移动
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if (e.type === 'mousemove') { // 鼠标事件
            clientX = e.clientX;
            clientY = e.clientY;
        } else {
            return; // 其他事件类型不处理
        }

        const deltaX = (clientX - this.translateX) / this.scale - this.canvasStartX;
        const deltaY = (clientY - this.translateY) / this.scale - this.canvasStartY;

        this.mergeOffset(deltaX * this.scale, deltaY * this.scale);
    };

    // 处理双指触摸移动事件 (保持不变)
    handleTouchMove = (e) => {
        if (e.touches.length === 2) {
            this.isDragging = false; // Ensure dragging is off when pinching
            this.shouldDrag = false;
            // ... (双指缩放逻辑保持不变)
            this.isPinching = true;
            const currentPinchDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            let scaleFactor = currentPinchDistance / this.startPinchDistance;
            let newScale = this.startScale * scaleFactor;

            newScale = Math.min(
                Math.max(newScale, Math.pow(this.zoomValue, this.zoomRange[1])),
                Math.pow(this.zoomValue, this.zoomRange[0])
            );
            newScale = Math.round(newScale * 100) / 100;
            this.scale = newScale;

            const rect = this.dragLayer.getBoundingClientRect();
            const mouseX = this.pinchCenter.x - rect.left;
            const mouseY = this.pinchCenter.y - rect.top;

            const worldX = (mouseX - this.translateX) / this.startScale;
            const worldY = (mouseY - this.translateY) / this.startScale;

            const targetTranslateX = mouseX - worldX * this.scale;
            const targetTranslateY = mouseY - worldY * this.scale;

            this.mergeOffset(targetTranslateX - this.translateX, targetTranslateY - this.translateY);
            this.updateTransform();
        } else if (e.touches.length === 1) {
            if (this.isPinching) {
                this.isPinching = false; // End pinching if finger count reduces to 1
                this.startPinchDistance = 0; // Reset pinch distance
            }
            if (this.isDragging) {
                this.handleMouseMove(e); // Continue dragging if already dragging
            } else {
                this.handleFirstMove(e); // Check for drag start if not yet dragging
            }
        } else {
            this.isPinching = false; // Reset pinching if touch count is not 1 or 2
            if (this.isDragging) {
                this.isDragging = false;
                this.shouldDrag = false;
                this.dragLayer.style.cursor = 'grab';
                document.removeEventListener('touchmove', this.handleMouseMove);
            }
        }
    }


    // 鼠标释放事件 (保持不变，同时处理鼠标和触摸释放)
    handleMouseUp = (e) => {
        // 清理事件监听 (保持不变)
        document.removeEventListener('mousemove', this.handleFirstMove);
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        document.removeEventListener('touchmove', this.handleFirstMove); // 清理 touchmove 的 handleFirstMove 监听
        document.removeEventListener('touchmove', this.handleMouseMove); // 清理 touchmove 的 handleMouseMove 监听
        document.removeEventListener('touchend', this.handleMouseUp);
        document.removeEventListener('touchcancel', this.handleMouseUp);

        // 重置双指缩放状态 (保持不变)
        this.isPinching = false;

        // 如果没有触发拖拽则执行点击 (保持不变)
        if (!this.shouldDrag && !this.isPinching) {
            this.dragLayer.style.pointerEvents = 'none';
            let clientX, clientY;

            if (e.type === 'touchend' || e.type === 'touchcancel' && e.changedTouches && e.changedTouches.length > 0) {
                const touch = e.changedTouches[0];
                if (touch) {
                    clientX = touch.clientX;
                    clientY = touch.clientY;
                } else {
                    clientX = NaN;
                    clientY = NaN;
                }
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }

            if (typeof clientX === 'number' && isFinite(clientX) && typeof clientY === 'number' && isFinite(clientY)) {
                const elementUnderMouse = document.elementFromPoint(clientX, clientY);
                this.dragLayer.style.pointerEvents = 'auto';
                if (elementUnderMouse) {
                    elementUnderMouse.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                }
            } else {
                console.warn("Invalid coordinates for elementFromPoint:", clientX, clientY, e);
                this.dragLayer.style.pointerEvents = 'auto';
            }
        }

        // 重置状态 (保持不变)
        this.isDragging = false;
        this.shouldDrag = false;
        this.dragLayer.style.cursor = 'grab';
    };

    // 滚轮缩放事件 (保持不变)
    handleWheel = (e) => {
        e.preventDefault();
        const originalScale = this.scale;
        const zoomFactor = this.zoomValue ** (e.deltaY > 0 ? 1 : -1);

        let newScale = originalScale * zoomFactor;
        newScale = Math.min(
            Math.max(newScale, Math.pow(this.zoomValue, this.zoomRange[1])),
            Math.pow(this.zoomValue, this.zoomRange[0])
        );
        newScale = Math.round(newScale * 100) / 100;
        this.scale = newScale;

        const rect = this.dragLayer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - this.translateX) / originalScale;
        const worldY = (mouseY - this.translateY) / originalScale;

        const targetTranslateX = mouseX - worldX * this.scale;
        const targetTranslateY = mouseY - worldY * this.scale;

        this.mergeOffset(targetTranslateX - this.translateX, targetTranslateY - this.translateY);
        this.updateTransform();
    };

    // 应用位移量 (保持不变)
    mergeOffset(x, y) {
        this.accumulatedX += x;
        this.accumulatedY += y;

        if (Math.abs(this.accumulatedX) > this.threshold || Math.abs(this.accumulatedY) > this.threshold) {
            const offsetX = Math.floor(this.accumulatedX / this.threshold) * this.threshold;
            const offsetY = Math.floor(this.accumulatedY / this.threshold) * this.threshold;

            this.translateX += offsetX;
            this.translateY += offsetY;
            this.accumulatedX -= offsetX;
            this.accumulatedY -= offsetY;

            this.updateTransform();
        }
    }

    // 更新变换样式 (保持不变)
    updateTransform() {
        requestAnimationFrame(() => {
            this.dragSpace.style.transform =
                `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
        });
    }
}
