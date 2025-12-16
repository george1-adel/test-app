// --- State Management ---
class AppState {
    constructor() {
        this.gameState = 'setup'; // setup, quiz, results
        this.questionCount = 3;
        this.quizQuestions = [];
        this.currentQIndex = 0;
        this.answers = {}; // { qId: { question, modelAnswer, userAnswer, aiFeedback, status, score } }
        this.loading = false;
        this.errorMsg = '';
    }

    reset() {
        this.gameState = 'setup';
        this.questionCount = 3;
        this.quizQuestions = [];
        this.currentQIndex = 0;
        this.answers = {};
        this.loading = false;
        this.errorMsg = '';
    }
}

// --- Main App Controller ---
class QuizApp {
    constructor() {
        this.state = new AppState();
        this.appContainer = document.getElementById('app');
        this.init();
    }

    init() {
        this.render();
    }

    render() {
        this.appContainer.innerHTML = '';

        const header = this.createHeader();
        this.appContainer.appendChild(header);

        const mainContent = document.createElement('div');
        mainContent.className = 'main-content';

        if (this.state.gameState === 'setup') {
            mainContent.appendChild(this.createSetupView());
        } else if (this.state.gameState === 'quiz') {
            mainContent.appendChild(this.createQuizView());
        } else if (this.state.gameState === 'results') {
            mainContent.appendChild(this.createResultsView());
        }

        this.appContainer.appendChild(mainContent);
    }

    createHeader() {
        const header = document.createElement('header');
        header.className = 'header';

        header.innerHTML = `
            <h1>نظام اختبار المقالات الذكي</h1>
            <p>مدعوم بواسطة Google Gemini AI</p>
        `;

        return header;
    }

    createSetupView() {
        const container = document.createElement('div');
        container.className = 'setup-content';

        const infoBox = document.createElement('div');
        infoBox.className = 'info-box';
        infoBox.textContent = 'تم تفعيل Gemini AI بنجاح. اختر عدد الأسئلة وابدأ الاختبار!';

        const countGroup = document.createElement('div');
        countGroup.className = 'input-group';
        countGroup.innerHTML = `
            <label for="countRange">عدد الأسئلة (${this.state.questionCount})</label>
            <input 
                type="range" 
                id="countRange"
                min="1" 
                max="${QUESTIONS_DB.length}" 
                value="${this.state.questionCount}"
                class="range-slider"
            />
            <div class="range-info">
                <span>1</span>
                <span>${QUESTIONS_DB.length}</span>
            </div>
        `; const errorBox = this.state.errorMsg ?
            this.createErrorBox(this.state.errorMsg) :
            document.createElement('div');

        const startBtn = document.createElement('button');
        startBtn.className = 'btn btn-primary';
        startBtn.textContent = 'بدء الامتحان';

        // Event listeners
        document.addEventListener('change', (e) => {
            if (e.target.id === 'apiKeyInput') {
                this.state.apiKey = e.target.value;
            }
            if (e.target.id === 'countRange') {
                this.state.questionCount = parseInt(e.target.value);
                countGroup.querySelector('label').textContent = `عدد الأسئلة (${this.state.questionCount})`;
                this.render();
            }
        });

        startBtn.addEventListener('click', () => this.startQuiz());

        container.appendChild(infoBox);
        container.appendChild(countGroup);
        if (this.state.errorMsg) container.appendChild(errorBox);
        container.appendChild(startBtn);

        return container;
    }

    createQuizView() {
        const container = document.createElement('div');
        container.className = 'quiz-content';

        const currentQuestion = this.state.quizQuestions[this.state.currentQIndex];
        const isAnswered = !!this.state.answers[currentQuestion.id];
        const currentAnswer = this.state.answers[currentQuestion.id];

        // Header with progress
        const header = document.createElement('div');
        header.className = 'quiz-header';
        header.innerHTML = `
            <span class="quiz-counter">سؤال ${this.state.currentQIndex + 1} من ${this.state.quizQuestions.length}</span>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${((this.state.currentQIndex + 1) / this.state.quizQuestions.length) * 100}%"></div>
            </div>
        `;

        // Question
        const questionEl = document.createElement('h2');
        questionEl.className = 'quiz-question';
        questionEl.textContent = currentQuestion.question;

        // Textarea
        const textarea = document.createElement('textarea');
        textarea.className = 'answer-textarea';
        textarea.placeholder = 'اكتب إجابتك هنا...';
        textarea.disabled = isAnswered || this.state.loading;

        if (isAnswered) {
            textarea.value = currentAnswer.userAnswer;
            textarea.classList.add(currentAnswer.status);
        }

        // Error message
        const errorBox = this.state.errorMsg ?
            this.createErrorBox(this.state.errorMsg) :
            document.createElement('div');

        // Buttons container
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'button-group';
        buttonGroup.style.marginTop = '1.5rem';

        if (!isAnswered) {
            const submitBtn = document.createElement('button');
            submitBtn.className = 'btn btn-primary';
            submitBtn.disabled = this.state.loading || !textarea.value.trim();
            submitBtn.innerHTML = this.state.loading
                ? '<div class="loader" style="display: inline-block; margin-right: 0.5rem;"></div> جاري التصحيح...'
                : 'إرسال الإجابة';

            submitBtn.addEventListener('click', () => {
                if (textarea.value.trim()) {
                    this.handleAnswerSubmit(textarea.value);
                }
            });

            textarea.addEventListener('input', () => {
                submitBtn.disabled = this.state.loading || !textarea.value.trim();
            });

            buttonGroup.appendChild(submitBtn);
        } else {
            // Feedback section
            const feedbackSection = this.createFeedbackSection(currentAnswer, currentQuestion);
            buttonGroup.appendChild(feedbackSection);

            // Buttons container for multiple buttons
            const buttonsContainer = document.createElement('div');
            buttonsContainer.style.display = 'grid';
            buttonsContainer.style.gridTemplateColumns = '1fr 1fr 1fr';
            buttonsContainer.style.gap = '0.5rem';

            // Reset button
            const resetBtn = document.createElement('button');
            resetBtn.className = 'btn btn-secondary';
            resetBtn.style.backgroundColor = '#f97316';
            resetBtn.style.fontSize = '0.85rem';
            resetBtn.textContent = 'إعادة';
            resetBtn.addEventListener('click', () => this.resetCurrentQuestion());

            // Skip button
            const skipBtn = document.createElement('button');
            skipBtn.className = 'btn btn-secondary';
            skipBtn.style.backgroundColor = '#6366f1';
            skipBtn.style.fontSize = '0.85rem';
            skipBtn.textContent = 'تخطي';
            skipBtn.addEventListener('click', () => this.skipQuestion());

            // Next button
            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn btn-secondary';
            nextBtn.style.fontSize = '0.85rem';
            nextBtn.textContent = this.state.currentQIndex < this.state.quizQuestions.length - 1
                ? 'التالي'
                : 'النتائج';
            nextBtn.addEventListener('click', () => this.nextQuestion());

            buttonsContainer.appendChild(resetBtn);
            buttonsContainer.appendChild(skipBtn);
            buttonsContainer.appendChild(nextBtn);
            buttonGroup.appendChild(buttonsContainer);
        }

        container.appendChild(header);
        container.appendChild(questionEl);

        const spacer = document.createElement('div');
        spacer.style.marginBottom = '1.5rem';

        container.appendChild(textarea);
        if (this.state.errorMsg) container.appendChild(errorBox);
        container.appendChild(buttonGroup);

        return container;
    }

    createFeedbackSection(answerData, question) {
        const section = document.createElement('div');
        section.className = `feedback-section feedback-${answerData.status}`;
        section.classList.add('animate-fade-in');

        const statusIcon = {
            correct: '✅ إجابة صحيحة',
            partial: '⚠️ إجابة ناقصة',
            incorrect: '❌ إجابة خاطئة'
        }[answerData.status];

        const statusColor = {
            correct: '#16a34a',
            partial: '#b45309',
            incorrect: '#dc2626'
        }[answerData.status];

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.gap = '0.5rem';
        header.style.marginBottom = '0.75rem';

        const statusText = document.createElement('span');
        statusText.style.color = statusColor;
        statusText.style.fontSize = '0.875rem';
        statusText.textContent = statusIcon;

        const scoreBadge = document.createElement('span');
        scoreBadge.style.fontSize = '0.75rem';
        scoreBadge.style.fontFamily = 'monospace';
        scoreBadge.style.backgroundColor = 'white';
        scoreBadge.style.padding = '0.25rem 0.5rem';
        scoreBadge.style.borderRadius = '0.25rem';
        scoreBadge.style.border = '1px solid #d1d5db';
        scoreBadge.textContent = `Score: ${answerData.score}/10`;

        header.appendChild(statusText);
        header.appendChild(scoreBadge);

        const feedback = document.createElement('p');
        feedback.style.color = '#374151';
        feedback.style.lineHeight = '1.8';
        feedback.style.fontSize = '0.95rem';
        feedback.style.marginBottom = '0.75rem';
        feedback.style.wordWrap = 'break-word';
        feedback.style.overflowWrap = 'break-word';
        feedback.textContent = answerData.feedback;

        section.appendChild(header);
        section.appendChild(feedback);

        if (answerData.status !== 'correct') {
            const divider = document.createElement('div');
            divider.style.marginTop = '0.75rem';
            divider.style.paddingTop = '0.75rem';
            divider.style.borderTop = '1px solid rgba(0,0,0,0.1)';

            const modelLabel = document.createElement('p');
            modelLabel.style.fontSize = '0.8rem';
            modelLabel.style.fontWeight = 'bold';
            modelLabel.style.color = '#6b7280';
            modelLabel.style.marginBottom = '0.5rem';
            modelLabel.style.textTransform = 'uppercase';
            modelLabel.style.letterSpacing = '0.5px';
            modelLabel.textContent = 'الإجابة النموذجية:';

            const modelAnswer = document.createElement('p');
            modelAnswer.style.fontSize = '0.95rem';
            modelAnswer.style.color = '#374151';
            modelAnswer.style.lineHeight = '1.8';
            modelAnswer.style.wordWrap = 'break-word';
            modelAnswer.style.overflowWrap = 'break-word';
            modelAnswer.textContent = question.model_answer;

            divider.appendChild(modelLabel);
            divider.appendChild(modelAnswer);
            section.appendChild(divider);
        }

        return section;
    }

    createResultsView() {
        const container = document.createElement('div');
        container.className = 'results-content';

        const totalQs = Object.keys(this.state.answers).length;
        const totalScore = Object.values(this.state.answers).reduce((acc, curr) => acc + (curr.score || 0), 0);
        const percentage = Math.round((totalScore / (totalQs * 10)) * 100);

        // Score section
        const scoreSection = document.createElement('div');
        scoreSection.style.marginBottom = '2rem';

        const title = document.createElement('h2');
        title.className = 'results-title';
        title.textContent = 'انتهى الاختبار!';

        const percentageEl = document.createElement('div');
        percentageEl.className = 'result-percentage';
        percentageEl.classList.add(percentage >= 50 ? 'high' : 'low');
        percentageEl.textContent = `%${percentage}`;

        const scoreText = document.createElement('p');
        scoreText.style.color = '#6b7280';
        scoreText.style.marginTop = '0.5rem';
        scoreText.textContent = `مجموع النقاط: ${totalScore} من ${totalQs * 10}`;

        scoreSection.appendChild(title);
        scoreSection.appendChild(percentageEl);
        scoreSection.appendChild(scoreText);
        container.appendChild(scoreSection);

        // Review section
        const reviewSection = document.createElement('div');
        reviewSection.className = 'results-review';

        const reviewTitle = document.createElement('h3');
        reviewTitle.textContent = 'مراجعة الإجابات:';
        reviewSection.appendChild(reviewTitle);

        Object.values(this.state.answers).forEach((ans, idx) => {
            const card = document.createElement('div');
            card.className = 'result-card';

            const questionText = document.createElement('p');
            questionText.className = 'answer-item-question';
            questionText.textContent = `س: ${ans.question}`;

            const scoreLine = document.createElement('div');
            scoreLine.className = 'score-line';

            const statusBadge = document.createElement('span');
            statusBadge.className = `status-badge status-${ans.status}`;
            statusBadge.textContent = {
                correct: 'صحيحة',
                partial: 'ناقصة',
                incorrect: 'خاطئة'
            }[ans.status];

            const scoreSpan = document.createElement('span');
            scoreSpan.className = 'score-text';
            scoreSpan.textContent = `${ans.score}/10`;

            scoreLine.appendChild(statusBadge);
            scoreLine.appendChild(scoreSpan);

            const userAnswerText = document.createElement('p');
            userAnswerText.className = 'answer-item-answer';
            userAnswerText.style.lineHeight = '1.7';
            userAnswerText.style.wordWrap = 'break-word';
            userAnswerText.style.overflowWrap = 'break-word';
            userAnswerText.innerHTML = `<span style="font-weight: 600;">إجابتك:</span> ${ans.userAnswer}`;

            const feedbackText = document.createElement('p');
            feedbackText.className = 'answer-item-feedback';
            feedbackText.style.lineHeight = '1.7';
            feedbackText.style.wordWrap = 'break-word';
            feedbackText.style.overflowWrap = 'break-word';
            feedbackText.innerHTML = `<span style="font-weight: 600;">المصحح:</span> ${ans.feedback}`;

            card.appendChild(questionText);
            card.appendChild(scoreLine);
            card.appendChild(userAnswerText);
            card.appendChild(feedbackText);
            reviewSection.appendChild(card);
        });

        container.appendChild(reviewSection);

        // Restart button
        const restartBtn = document.createElement('button');
        restartBtn.className = 'btn btn-primary';
        restartBtn.style.marginTop = '2rem';
        restartBtn.textContent = 'اختبار جديد';
        restartBtn.addEventListener('click', () => this.restart());

        container.appendChild(restartBtn);

        return container;
    }

    createErrorBox(message) {
        const box = document.createElement('div');
        box.className = 'error-message';
        box.textContent = message;
        return box;
    }

    startQuiz() {
        // Shuffle and select questions
        const shuffled = [...QUESTIONS_DB].sort(() => 0.5 - Math.random());
        this.state.quizQuestions = shuffled.slice(0, Math.min(this.state.questionCount, QUESTIONS_DB.length));

        this.state.gameState = 'quiz';
        this.state.currentQIndex = 0;
        this.state.answers = {};
        this.state.errorMsg = '';

        this.render();
    }

    async handleAnswerSubmit(userAnswer) {
        this.state.loading = true;
        this.render();

        const currentQ = this.state.quizQuestions[this.state.currentQIndex];
        this.state.errorMsg = '';

        try {
            const aiResult = await this.evaluateAnswerWithGemini(
                currentQ.question,
                currentQ.model_answer,
                userAnswer
            );

            this.state.answers[currentQ.id] = {
                question: currentQ.question,
                modelAnswer: currentQ.model_answer,
                userAnswer: userAnswer,
                ...aiResult
            };

        } catch (err) {
            console.error("Evaluation Error:", err);
            this.state.errorMsg = `حدث خطأ: ${err.message || "فشل الاتصال بالخادم"}`;
        } finally {
            this.state.loading = false;
            this.render();
        }
    }

    nextQuestion() {
        if (this.state.currentQIndex < this.state.quizQuestions.length - 1) {
            this.state.currentQIndex++;
            this.state.errorMsg = '';
        } else {
            this.state.gameState = 'results';
        }
        this.render();
    }

    resetCurrentQuestion() {
        const currentQ = this.state.quizQuestions[this.state.currentQIndex];
        // حذف إجابة السؤال الحالي
        delete this.state.answers[currentQ.id];
        // إعادة تصيير الصفحة
        this.render();
    }

    skipQuestion() {
        // الانتقال للسؤال التالي مباشرة دون الإجابة
        if (this.state.currentQIndex < this.state.quizQuestions.length - 1) {
            this.state.currentQIndex++;
            this.state.errorMsg = '';
        } else {
            this.state.gameState = 'results';
        }
        this.render();
    }

    restart() {
        this.state.reset();
        this.render();
    }

    async evaluateAnswerWithGemini(question, modelAnswer, userAnswer) {
        // الاتصال بالـ Serverless Function بدلاً من Gemini مباشرة
        // هذا يحمي API key من الظهور في الكود الأمامي
        const response = await fetch('/api/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question,
                modelAnswer,
                userAnswer
            })
        });

        if (!response.ok) {
            let errorDetails = 'فشل الاتصال بالخادم';
            try {
                const errData = await response.json();
                errorDetails = errData.error || errorDetails;
            } catch (e) {
                // ignore JSON parse error
            }
            throw new Error(errorDetails);
        }

        const result = await response.json();
        return result;
    }
}

// --- Initialize App ---
document.addEventListener('DOMContentLoaded', () => {
    new QuizApp();
});