// 실시간 신청자 카운터 위젯
class SeminarCounter {
    constructor(seminarId, containerElement) {
        this.seminarId = seminarId;
        this.container = containerElement;
        this.count = 0;
        this.animating = false;
        
        this.init();
    }
    
    init() {
        this.render();
        this.startRealTimeSync();
    }
    
    render() {
        this.container.innerHTML = `
            <div class="counter-widget" style="
                background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
                padding: 20px 30px;
                border-radius: 15px;
                text-align: center;
                box-shadow: 0 5px 20px rgba(255, 165, 0, 0.3);
                margin: 20px 0;
            ">
                <div style="font-size: 16px; color: #000; font-weight: bold; margin-bottom: 10px;">
                    🎉 실시간 신청 현황
                </div>
                <div class="counter-value" style="
                    font-size: 48px;
                    font-weight: bold;
                    color: #000;
                    font-family: 'Arial', sans-serif;
                    transition: all 0.3s;
                ">${this.count}</div>
                <div style="font-size: 14px; color: #333; margin-top: 10px;">
                    명이 신청했습니다
                </div>
            </div>
        `;
    }
    
    // Firebase Realtime Database와 연동
    startRealTimeSync() {
        // 실제 구현시 Firebase 연동
        // db.ref(`counters/${this.seminarId}`).on('value', (snapshot) => {
        //     this.updateCount(snapshot.val() || 0);
        // });
        
        // 데모: 로컬 스토리지 사용
        this.loadFromLocalStorage();
        this.simulateRealTime();
    }
    
    updateCount(newCount) {
        if (this.count === newCount) return;
        
        this.animateCountChange(newCount);
    }
    
    animateCountChange(targetCount) {
        if (this.animating) return;
        this.animating = true;
        
        const element = this.container.querySelector('.counter-value');
        const startCount = this.count;
        const diff = targetCount - startCount;
        const duration = 1000;
        const steps = 30;
        const stepValue = diff / steps;
        const stepDuration = duration / steps;
        
        let currentStep = 0;
        
        // 애니메이션 효과
        element.style.transform = 'scale(1.2)';
        element.style.color = '#FF6B6B';
        
        const interval = setInterval(() => {
            currentStep++;
            this.count = Math.round(startCount + (stepValue * currentStep));
            element.textContent = this.count;
            
            if (currentStep >= steps) {
                clearInterval(interval);
                this.count = targetCount;
                element.textContent = this.count;
                element.style.transform = 'scale(1)';
                element.style.color = '#000';
                this.animating = false;
                this.saveToLocalStorage();
            }
        }, stepDuration);
    }
    
    // 로컬 스토리지 저장/로드
    saveToLocalStorage() {
        localStorage.setItem(`counter_${this.seminarId}`, this.count);
    }
    
    loadFromLocalStorage() {
        const saved = localStorage.getItem(`counter_${this.seminarId}`);
        if (saved) {
            this.count = parseInt(saved);
            this.render();
        }
    }
    
    // 데모용: 랜덤 증가 시뮬레이션
    simulateRealTime() {
        setInterval(() => {
            // 5-30초마다 1-3명씩 랜덤 증가
            if (Math.random() > 0.7) {
                const increase = Math.floor(Math.random() * 3) + 1;
                this.updateCount(this.count + increase);
            }
        }, Math.random() * 25000 + 5000);
    }
    
    // 수동 증가 (신청 버튼 클릭시 호출)
    increment(amount = 1) {
        this.updateCount(this.count + amount);
    }
}

// 사용법:
// const counter = new SeminarCounter('2026-02', document.getElementById('counterContainer'));
