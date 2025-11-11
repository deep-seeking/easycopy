// 极简粒子效果 - 确保可见性
console.log('极简粒子效果脚本执行');

// 直接执行，不等待DOM加载
setTimeout(function() {
    console.log('开始创建canvas');
    
    // 创建canvas元素
    var canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '9999'; // 最高层级
    canvas.style.backgroundColor = 'rgba(0,0,0,0.01)'; // 几乎透明但确保canvas存在
    
    // 添加到body
    document.body.appendChild(canvas);
    console.log('Canvas已添加到body');
    
    // 设置canvas实际尺寸
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    console.log('Canvas尺寸:', canvas.width, 'x', canvas.height);
    
    // 获取绘制上下文
    var ctx = canvas.getContext('2d');
    console.log('获取上下文结果:', ctx !== null);
    
    // 创建简单粒子数组
    var particles = [];
    var count = 20; // 少量但明显的粒子
    
    // 预定义颜色数组
    var colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'];
    
    // 初始化粒子
    for (var i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: 20, // 大尺寸方块
            speedX: (Math.random() - 0.5) * 4,
            speedY: (Math.random() - 0.5) * 4,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }
    console.log('已创建', particles.length, '个大粒子');
    
    // 绘制函数
    function draw() {
        // 清除画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 绘制所有粒子（使用方块而非圆形）
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            
            // 填充颜色
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
            
            // 白色边框
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
            
            // 更新位置
            p.x += p.speedX;
            p.y += p.speedY;
            
            // 边界反弹
            if (p.x < 0 || p.x > canvas.width) p.speedX *= -1;
            if (p.y < 0 || p.y > canvas.height) p.speedY *= -1;
        }
        
        // 继续动画
        requestAnimationFrame(draw);
    }
    
    // 启动动画
    draw();
    console.log('粒子动画已启动');
}, 100); // 短暂延迟确保DOM已加载