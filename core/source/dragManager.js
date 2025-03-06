// dragManager.js
import {BASE, DERIVED, EDITOR, SYSTEM, USER} from '../manager.js';

/**
 * @description 拖拽管理器 - 用于管理拖拽操作，支持鼠标和触摸操作，包括双指缩放和拖动
 */
export class Drag {
    constructor() {
        // 初始化变换参数
        this.translateX = 0;
        this.translateY = 0;
        this.scale = 1;
        this.isDragging = false; // 是否正在单指拖动
        this.isPinching = false; // 是否正在双指缩放或拖动
        this.accumulatedX = 0;
        this.accumulatedY = 0;
        this.threshold = 1;
        this.zoomValue = 0.9;
        this.zoomRange = [-5, 10];
        this.elements = new Map();

        // 拖拽阈值，移动超过此距离才视为拖拽
        this.dragThreshold = 10;
        this.initialPosition = { x: 0, y: 0 }; // 初始触摸位置
        this.shouldDrag = false; // 是否应该触发拖拽

        // 双指操作相关变量
        this.initialPinchDistance = 0; // 初始双指距离
        this.initialScale = 1; // 初始缩放比例
        this.initialTranslateX = 0; // 初始 X 位移
        this.initialTranslateY = 0; // 初始 Y 位移
        this.startTouches = []; // 记录开始触摸的手指信息

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
        this.dragLayer.addEventListener('touchstart', this.handleTouchStart); // 修改为 handleTouchStart
        this.dragLayer.addEventListener('wheel', this.handleWheel, { passive: false });
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
        // 鼠标按下事件
    handleMouseDown = (e) => {
        if (e.button === 0) { // 仅处理鼠标左键
            this.startDrag(e.clientX, e.clientY);
            document.addEventListener('mousemove', this.handleFirstMove);
            document.addEventListener('mouseup', this.handleMouseUp);
        }
    };

    // 触摸开始事件
    handleTouchStart = (e) => {
        e.preventDefault(); // 阻止默认触摸事件，例如双击缩放
        if (e.touches.length === 1) {
            // 单指触摸，开始拖动
            const touch = e.touches[0];
            this.startDrag(touch.clientX, touch.clientY);
            document.addEventListener('touchmove', this.handleFirstMove);
            document.addEventListener('touchend', this.handleMouseUp);
            this.startTouches = Array.from(e.touches); // 记录初始触摸手指
        } else if (e.touches.length === 2) {
            // 双指触摸，开始缩放或双指拖动
            this.isPinching = true;
            this.initialPinchDistance = this.getDistance(e.touches); // 计算初始双指距离
            this.initialScale = this.scale; // 记录初始缩放比例
            this.initialTranslateX = this.translateX; // 记录初始 X 位移
            this.initialTranslateY = this.translateY; // 记录初始 Y 位移
            this.startTouches = Array.from(e.touches); // 记录初始触摸手指

            document.addEventListener('touchmove', this.handlePinchMove); // 监听双指移动
            document.addEventListener('touchend', this.handlePinchEnd); // 监听双指结束
        }
    };

    // 开始拖动，鼠标和单指触摸通用逻辑
    startDrag = (clientX, clientY) => {
        this.initialPosition.x = clientX;
        this.initialPosition.y = clientY;

        this.dragLayer.style.pointerEvents = 'none'; // 临时禁用 pointerEvents，为了获取点击穿透的元素
        const elementUnderMouse = document.elementFromPoint(clientX, clientY); // 获取鼠标位置下的元素
        this.dragLayer.style.pointerEvents = 'auto'; // 恢复 pointerEvents

        if (elementUnderMouse?.closest('button, [onclick], a')) { // 如果点击在按钮、有onclick属性的元素或链接上
            elementUnderMouse.dispatchEvent(new MouseEvent('click', { bubbles: true })); // 触发点击事件
            return; // 结束拖动开始流程
        }

        this.isDragging = false; // 标记为未开始拖拽，在移动超过阈值后才开始
        this.shouldDrag = false; // 标记为不应该触发点击，在拖拽后设置为 true
        this.startX = clientX; // 记录拖拽起始 X 坐标
        this.startY = clientY; // 记录拖拽起始 Y 坐标
    }

    handleFirstMove = (e) => {
        let clientX, clientY;
        if (e.type === 'touchmove') {
            if (e.touches.length !== 1 || this.isPinching) return; // 如果不是单指触摸或正在双指操作，则不处理
            const touch = e.touches[0];
            clientX = touch.clientX;
            clientY = touch.clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const dx = clientX - this.initialPosition.x;
        const dy = clientY - this.initialPosition.y;

        if (Math.sqrt(dx * dx + dy * dy) > this.dragThreshold) { // 移动距离超过阈值
            this.isDragging = true; // 标记为正在拖拽
            this.shouldDrag = true; // 标记为应该阻止点击事件
            this.dragLayer.style.cursor = 'grabbing'; // 更改鼠标样式为 grabbing

            this.canvasStartX = (this.startX - this.translateX) / this.scale; // 计算拖拽起始点在画布坐标系中的位置
            this.canvasStartY = (this.startY - this.translateY) / this.scale;

            document.removeEventListener('mousemove', this.handleFirstMove); // 移除首次移动监听器
            document.addEventListener('mousemove', this.handleMouseMove); // 添加持续移动监听器
            document.removeEventListener('touchmove', this.handleFirstMove); // 移除首次移动监听器
            document.addEventListener('touchmove', this.handleMouseMove); // 添加持续移动监听器
            this.handleMouseMove(e); // 立即执行一次移动，更新位置
        }
    };

    handleMouseMove = (e) => {
        if (!this.isDragging && !this.isPinching) return; // 如果没有开始拖拽或双指操作，则不处理

        let clientX, clientY;
        if (e.type === 'touchmove') {
            if (e.touches.length !== 1 || this.isPinching) return; // 如果不是单指触摸或正在双指操作，则不处理
            const touch = e.touches[0];
            clientX = touch.clientX;
            clientY = touch.clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const deltaX = (clientX - this.translateX) / this.scale - this.canvasStartX; // 计算 X 轴方向的拖拽距离（画布坐标系）
        const deltaY = (clientY - this.translateY) / this.scale - this.canvasStartY; // 计算 Y 轴方向的拖拽距离（画布坐标系）

        this.mergeOffset(deltaX * this.scale, deltaY * this.scale); // 合并位移量，应用到画布
    };


    // 鼠标/触摸释放事件
    handleMouseUp = (e) => {
        // 清理事件监听
        document.removeEventListener('mousemove', this.handleFirstMove);
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        document.removeEventListener('touchmove', this.handleFirstMove);
        document.removeEventListener('touchmove', this.handleMouseMove);
        document.removeEventListener('touchend', this.handleMouseUp);

        // 如果没有触发拖拽则执行点击
        if (!this.shouldDrag && !this.isPinching) { // 只有在没有拖拽且没有双指操作时才触发点击
            this.dragLayer.style.pointerEvents = 'none';
            let clientX, clientY;

            if (e.type === 'touchend' && e.changedTouches && e.changedTouches.length > 0) { // 检查 e.changedTouches 是否存在且不为空
                const touch = e.changedTouches[0]; // 获取第一个 touch 对象
                if (touch) { // 确保 touch 对象存在
                    clientX = touch.clientX;
                    clientY = touch.clientY;
                } else {
                    clientX = NaN; // 如果 touch 不存在，则设置为 NaN，表示无效坐标
                    clientY = NaN;
                }
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }

            // 检查 clientX 和 clientY 是否是有效的数字
            if (typeof clientX === 'number' && isFinite(clientX) && typeof clientY === 'number' && isFinite(clientY)) {
                const elementUnderMouse = document.elementFromPoint(clientX, clientY);
                this.dragLayer.style.pointerEvents = 'auto';
                if (elementUnderMouse) {
                    elementUnderMouse.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                }
            } else {
                console.warn("Invalid coordinates for elementFromPoint:", clientX, clientY, e); // 打印警告信息，方便调试
                this.dragLayer.style.pointerEvents = 'auto'; // 即使坐标无效，也要恢复 pointerEvents
            }
        }

        // 重置状态
        this.isDragging = false;
        this.shouldDrag = false;
        this.dragLayer.style.cursor = 'grab';
    };

    // 计算两点之间的距离
    getDistance = (touches) => {
        const touch1 = touches[0];
        const touch2 = touches[1];
        return Math.sqrt(Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2));
    };

    // 计算两指的中心点
    getMidpoint = (touches) => {
        const touch1 = touches[0];
        const touch2 = touches[1];
        return {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        };
    };

    // 双指缩放/拖动事件
    handlePinchMove = (e) => {
        if (!this.isPinching || e.touches.length !== 2) return; // 如果不是双指操作或触摸点不是两个，则不处理
        e.preventDefault(); // 阻止默认触摸行为，例如页面滚动

        const currentPinchDistance = this.getDistance(e.touches); // 计算当前双指距离
        const scaleFactor = currentPinchDistance / this.initialPinchDistance; // 计算缩放比例因子
        let newScale = this.initialScale * scaleFactor; // 计算新的缩放比例

        // 限制缩放范围
        newScale = Math.min(
            Math.max(newScale, Math.pow(this.zoomValue, this.zoomRange[1])),
            Math.pow(this.zoomValue, this.zoomRange[0])
        );
        newScale = Math.round(newScale * 100) / 100; // 保留两位小数
        this.scale = newScale; // 更新缩放比例

        // 计算缩放中心点
        const midpoint = this.getMidpoint(e.touches);
        const rect = this.dragLayer.getBoundingClientRect();
        const mouseX = midpoint.x - rect.left;
        const mouseY = midpoint.y - rect.top;

        // 计算新的位移值，保持缩放中心点位置不变
        const worldX = (mouseX - this.initialTranslateX) / this.initialScale;
        const worldY = (mouseY - this.initialTranslateY) / this.initialScale;

        const targetTranslateX = mouseX - worldX * this.scale;
        const targetTranslateY = mouseY - worldY * this.scale;

        this.translateX = targetTranslateX; // 更新 X 位移
        this.translateY = targetTranslateY; // 更新 Y 位移

        this.updateTransform(); // 更新变换
    };

    // 双指操作结束事件
    handlePinchEnd = (e) => {
        if (!this.isPinching) return; // 如果不是双指操作，则不处理

        document.removeEventListener('touchmove', this.handlePinchMove); // 移除双指移动监听
        document.removeEventListener('touchend', this.handlePinchEnd); // 移除双指结束监听

        this.isPinching = false; // 重置双指操作状态
        this.startTouches = []; // 清空初始触摸手指记录
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

        // const dynamicThreshold = this.threshold;

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
