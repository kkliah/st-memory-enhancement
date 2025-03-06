// dragManager.js
import {BASE, DERIVED, EDITOR, SYSTEM, USER} from '../manager.js';

/**
 * @description 拖拽管理器 - 用于管理拖拽操作
 */
export class Drag {
    constructor() {
        // 初始化变换参数
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

        // 新增阈值变量
        this.dragThreshold = 10; // 移动超过10px视为拖拽
        this.initialPosition = { x: 0, y: 0 };
        this.shouldDrag = false;

        // 双指缩放相关变量
        this.isPinching = false; // 标记是否正在进行双指缩放
        this.startPinchDistance = 0; // 初始双指距离
        this.startScale = 1; // 缩放开始时的 scale 值
        this.pinchCenter = { x: 0, y: 0 }; // 缩放中心点

        // 创建容器结构
        this.dragContainer = document.createElement('div');
        this.dragContainer.style.position = 'relative';
        this.dragContainer.style.display = 'flex';
        this.dragContainer.style.flexGrow = '1';
        this.dragContainer.style.flexShrink = '0';
        this.dragContainer.style.width = '100%';
        this.dragContainer.style.height = '100%';
        this.dragContainer.style.minHeight = '500px';
        this.dragContainer.style.overflow = 'hidden';
        // this.dragContainer.style.background = '#32282b';

        // 创建可拖动内容层
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

        // 创建拖动事件层
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

        // 绑定事件处理
        this.dragLayer.addEventListener('mousedown', this.handleMouseDown);
        this.dragLayer.addEventListener('touchstart', this.handleTouchStart); // 修改：绑定 touchstart 事件为 handleTouchStart
        this.dragLayer.addEventListener('wheel', this.handleWheel, { passive: false });
        this.dragLayer.addEventListener('touchmove', this.handleTouchMove); // 新增：绑定 touchmove 事件为 handleTouchMove
        this.dragLayer.addEventListener('touchend', this.handleMouseUp); // touch 事件的 touchend 和 mouseup 使用同一个处理函数
        this.dragLayer.addEventListener('touchcancel', this.handleMouseUp); // 新增：绑定 touchcancel 事件，处理触摸取消的情况
    }


    /**
     * 获取渲染元素，用于挂载到页面上
     * @returns {HTMLDivElement}
     */
    get render() {
        return this.dragContainer;
    }

    /**
     * 设置样式，支持对象形式
     * @param style
     * @example style({background: 'red', color: 'white'})
     */
    style(style){
        this.dragContainer.style = {...this.dragContainer.style, ...style};
    }

    /**
     * 添加元素，支持设置初始位置，默认为[0, 0]
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
     * 移动元素到指定位置，默认为[0, 0]
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
     * 删除元素，同时会从页面上移除
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
        // 鼠标按下和触摸开始事件统一处理
    handleTouchStart = (e) => {
        if (e.touches.length === 2) {
            // 双指操作，开始缩放
            this.isPinching = true;
            this.isDragging = false; // 双指缩放时，取消拖拽状态
            this.shouldDrag = false;
            this.startPinchDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            this.startScale = this.scale;

            // 计算双指中心点作为缩放中心
            this.pinchCenter = {
                x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
            };
        } else if (e.touches.length === 1) {
            // 单指操作，调用原有的 handleMouseDown 处理拖拽逻辑
            this.handleMouseDown(e);
        }
    }

    // 鼠标按下事件 (单指触摸也复用此逻辑)
    handleMouseDown = (e) => {
        if (e.button === 0 || e.type === 'touchstart') { // touchstart 事件也会进入这里，统一处理单指拖拽
            let clientX, clientY, touches;
            if (e.type === 'touchstart') {
                touches = e.touches;
                if (touches.length > 0) { // 确保 touches 数组不为空
                    clientX = touches[0].clientX;
                    clientY = touches[0].clientY;
                } else {
                    return; // 如果 touches 为空，则直接返回，不处理
                }
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
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

            document.addEventListener('mousemove', this.handleFirstMove);
            document.addEventListener('mouseup', this.handleMouseUp);
            document.addEventListener('touchmove', this.handleFirstMove); // touchmove 事件也需要触发 handleFirstMove 来判断是否开始拖拽
            document.addEventListener('touchend', this.handleMouseUp);
        }
    };

    handleFirstMove = (e) => {
        let clientX, clientY, touches;
        if (e.type === 'touchmove') {
            touches = e.touches;
            if (touches.length > 0) {
                clientX = touches[0].clientX;
                clientY = touches[0].clientY;
            } else {
                return;
            }
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const dx = clientX - this.initialPosition.x;
        const dy = clientY - this.initialPosition.y;

        if (Math.sqrt(dx * dx + dy * dy) > this.dragThreshold) {
            this.isDragging = true;
            this.shouldDrag = true;
            this.dragLayer.style.cursor = 'grabbing';

            this.canvasStartX = (this.startX - this.translateX) / this.scale;
            this.canvasStartY = (this.startY - this.translateY) / this.scale;

            document.removeEventListener('mousemove', this.handleFirstMove);
            document.addEventListener('mousemove', this.handleMouseMove);
            document.removeEventListener('touchmove', this.handleFirstMove);
            document.addEventListener('touchmove', this.handleMouseMove);
            this.handleMouseMove(e);
        }
    };

    handleMouseMove = (e) => {
        if (!this.isDragging) return;

        let clientX, clientY, touches;
        if (e.type === 'touchmove') {
            touches = e.touches;
            if (touches.length > 0) {
                clientX = touches[0].clientX;
                clientY = touches[0].clientY;
            } else {
                return;
            }
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const deltaX = (clientX - this.translateX) / this.scale - this.canvasStartX;
        const deltaY = (clientY - this.translateY) / this.scale - this.canvasStartY;

        this.mergeOffset(deltaX * this.scale, deltaY * this.scale);
    };

    // 处理双指触摸移动事件
    handleTouchMove = (e) => {
        if (this.isPinching && e.touches.length === 2) {
            const currentPinchDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            let scaleFactor = currentPinchDistance / this.startPinchDistance;
            let newScale = this.startScale * scaleFactor;

            // 限制缩放范围，与滚轮缩放保持一致
            newScale = Math.min(
                Math.max(newScale, Math.pow(this.zoomValue, this.zoomRange[1])),
                Math.pow(this.zoomValue, this.zoomRange[0])
            );
            newScale = Math.round(newScale * 100) / 100;
            this.scale = newScale;

            // 计算新的位移值，保持缩放中心不变
            const rect = this.dragLayer.getBoundingClientRect();
            const mouseX = this.pinchCenter.x - rect.left; // 使用 pinchCenter
            const mouseY = this.pinchCenter.y - rect.top;  // 使用 pinchCenter

            const worldX = (mouseX - this.translateX) / this.startScale; // 使用 startScale
            const worldY = (mouseY - this.translateY) / this.startScale; // 使用 startScale

            const targetTranslateX = mouseX - worldX * this.scale;
            const targetTranslateY = mouseY - worldY * this.scale;

            this.mergeOffset(targetTranslateX - this.translateX, targetTranslateY - this.translateY);
            this.updateTransform();
        } else if (!this.isDragging && !this.isPinching && e.touches.length === 1) {
            // 如果不是双指缩放，且没有开始拖拽，但是是单指移动，则触发 handleFirstMove 判断是否开始拖拽
            this.handleFirstMove(e);
        } else if (this.isDragging && e.touches.length === 1) {
            // 如果已经开始拖拽，则继续处理拖拽逻辑
            this.handleMouseMove(e);
        }
    }


    // 鼠标释放事件
    handleMouseUp = (e) => {
        // 清理事件监听
        document.removeEventListener('mousemove', this.handleFirstMove);
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        document.removeEventListener('touchmove', this.handleFirstMove);
        document.removeEventListener('touchmove', this.handleMouseMove);
        document.removeEventListener('touchend', this.handleMouseUp);
        document.removeEventListener('touchcancel', this.handleMouseUp); // 清理 touchcancel 监听

        // 重置双指缩放状态
        this.isPinching = false;

        // 如果没有触发拖拽则执行点击 (鼠标和单指触摸释放都走这里)
        if (!this.shouldDrag && !this.isPinching) { // 增加 !this.isPinching 判断，避免双指缩放后触发点击
            this.dragLayer.style.pointerEvents = 'none';
            let clientX, clientY;

            if (e.type === 'touchend' || e.type === 'touchcancel' && e.changedTouches && e.changedTouches.length > 0) { // 同时处理 touchend 和 touchcancel
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

        // 重置状态
        this.isDragging = false;
        this.shouldDrag = false;
        this.dragLayer.style.cursor = 'grab';
    };

    // 滚轮缩放事件 (保持不变)
    handleWheel = (e) => {
        e.preventDefault();
        const originalScale = this.scale;
        const zoomFactor = this.zoomValue ** (e.deltaY > 0 ? 1 : -1);

        // 计算新缩放比例
        let newScale = originalScale * zoomFactor;
        newScale = Math.min(
            Math.max(newScale, Math.pow(this.zoomValue, this.zoomRange[1])),
            Math.pow(this.zoomValue, this.zoomRange[0])
        );
        newScale = Math.round(newScale * 100) / 100;
        this.scale = newScale;

        // 计算缩放中心
        const rect = this.dragLayer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // 计算新的位移值
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
