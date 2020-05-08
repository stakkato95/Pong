'use strict';

////////////////////////////////////////////////////
// Constants
////////////////////////////////////////////////////

const PLAY_FIELD_HEIGHT = 600;
const PLAY_FIELD_WIDTH = 1000;

////////////////////////////////////////////////////
// Helper functions
////////////////////////////////////////////////////
function isCollision(ball, objTwo) {
    var intersectionPosition = ball.getBounds().intersects(objTwo.getBounds());
    if (intersectionPosition) {
        ball.handleCollision(objTwo, intersectionPosition);
    }
}

function getCosSin(angleDeg) {
    var angleRad = degToRad(angleDeg);
    return [Math.cos(angleRad), Math.sin(angleRad)];
}

function degToRad(deg) {
    return Math.PI * deg / 180;
}

////////////////////////////////////////////////////
// Helper classes
////////////////////////////////////////////////////

class StateMachine {

    static #NEW_GAME_TIME_OUT = 2000;

    static State = {
        PLAYING: 0,
        GAME_OVER: 1
    };

    static Event = {
        WIN_AI: 0,
        WIN_USER: 1,
        START_NEW_GAME: 2
    };

    static #state = StateMachine.State.GAME_OVER;
    static #subscriptions = {
        [StateMachine.Event.WIN_AI]: [],
        [StateMachine.Event.WIN_USER]: [],
        [StateMachine.Event.START_NEW_GAME]: []
    };

    static postEvent(event) {
        StateMachine.processEvent(event)
    }

    static processEvent(event) {
        switch (StateMachine.#state) {
            case StateMachine.State.PLAYING:
                if (event === StateMachine.Event.WIN_AI) {
                    StateMachine.#state = StateMachine.State.GAME_OVER;
                    StateMachine.startNewGameTimeout();
                } else if (event === StateMachine.Event.WIN_USER) {
                    StateMachine.#state = StateMachine.State.GAME_OVER;
                    StateMachine.startNewGameTimeout();
                }
                break;
            case StateMachine.State.GAME_OVER:
                if (event === StateMachine.Event.START_NEW_GAME) {
                    StateMachine.#state = StateMachine.State.PLAYING;
                }
                break;
        }

        for (var subscriber of StateMachine.#subscriptions[event]) {
            subscriber.onEvent(event);
        }
    }

    static startNewGameTimeout() {
        setTimeout(() => StateMachine.postEvent(StateMachine.Event.START_NEW_GAME), StateMachine.#NEW_GAME_TIME_OUT);
    }

    static subscribe(event, subscriber) {
        StateMachine.#subscriptions[event].push(subscriber);
    }
}

class ScoreBoard {

    #text;
    #userScore = 0;
    #aiScore = 0;
    
    constructor(elementId) {
        this.#text = document.getElementById(elementId);

        StateMachine.subscribe(StateMachine.Event.WIN_USER, this);
        StateMachine.subscribe(StateMachine.Event.WIN_AI, this);
    }

    onEvent(event) {
        if (event === StateMachine.Event.WIN_USER) {
            this.#userScore++;
        } else if (event === StateMachine.Event.WIN_AI) {
            this.#aiScore++;
        }

        this.#text.innerHTML = `${this.#userScore} : ${this.#aiScore}`
    }
}

////////////////////////////////////////////////////
// Base classes
////////////////////////////////////////////////////

class Rectangle {

    top;
    left;
    bottom;
    right;

    constructor(top, left, bottom, right) {
        this.top = top;
        this.left = left;
        this.bottom = bottom;
        this.right = right;
    }

    intersects(paddle) {
        var leftInBetween = paddle.left <= this.left && this.left <= paddle.right;
        var rightInBetween = paddle.left <= this.right && this.right <= paddle.right;

        var topInBetween = paddle.top <= this.top && this.top <= paddle.bottom;
        var bottomInBetween = paddle.top <= this.bottom && this.bottom <= paddle.bottom;

        if ((leftInBetween || rightInBetween) && (topInBetween || bottomInBetween)) {
            var paddleSurface = paddle.bottom - paddle.top;
            var ballPosition = this.bottom - paddle.top;
            return ballPosition / paddleSurface;
        }
    }
}

class GameObject {
    
    static State = {
        PLAYING: 0,
        GAME_OVER: 1
    };

    element;
    state;

    constructor(elementId) {
        this.element = document.getElementById(elementId);

        this.state = GameObject.State.PLAYING;

        StateMachine.subscribe(StateMachine.Event.START_NEW_GAME, this);
        StateMachine.subscribe(StateMachine.Event.WIN_USER, this);
        StateMachine.subscribe(StateMachine.Event.WIN_AI, this);
    }

    getId() {
        return this.element.id;
    }

    draw() { }

    getBounds() { }

    onEvent(event) {
        switch (this.state) {
            case GameObject.State.GAME_OVER:
                if (event === StateMachine.Event.START_NEW_GAME) {
                    this.state = GameObject.State.PLAYING;
                }
                break;
            case GameObject.State.PLAYING:
                if (event === StateMachine.Event.WIN_AI || event === StateMachine.Event.WIN_USER) {
                    this.state = GameObject.State.GAME_OVER;
                }
                break;
        }
    }
}

class Paddle extends GameObject {

    static #PADDLE_MOVEMENET_RANGE = 400;
    static PADDLE_HEIGHT = 200;

    yPosition;

    constructor(elementId) {
        super(elementId);
        this.moveToStartPosition();
    }

    move(offset) {
        var underflow = this.isUnderflow(offset);
        var overflow = this.isOverflow(offset);
        if (underflow) {
            this.yPosition = 0;
        } else if (overflow) {
            this.yPosition = Paddle.#PADDLE_MOVEMENET_RANGE;
        }

        if (!(underflow || overflow)) {
            this.yPosition += offset;
        }

        this.redraw();
    }

    moveToStartPosition() {
        this.yPosition = 200;
        this.redraw();
    }

    isUnderflow(offset) {
        return this.yPosition + offset <= 0 && offset < 0;
    }

    isOverflow(offset) {
        return this.yPosition + offset >= Paddle.#PADDLE_MOVEMENET_RANGE && offset > 0;
    }

    redraw() {
        //???
        this.element.style.top = this.yPosition + 'px';
        this.element.style.display = 'none';
        this.element.style.display = 'block';
    }

    getBounds() {
        super.getBounds();
        //top left bottom right
        var top = parseInt(this.element.style.top);
        var left = parseInt(this.element.style.left);

        return new Rectangle(
            top,
            isNaN(left) ? PLAY_FIELD_WIDTH - Ball.BALL_SIZE : 0,
            top + Paddle.PADDLE_HEIGHT,
            isNaN(left) ? PLAY_FIELD_WIDTH : Ball.BALL_SIZE);
    }

    onEvent(event) {
        super.onEvent(event);
        if (event === StateMachine.Event.START_NEW_GAME) {
            this.moveToStartPosition();
        }
    }
}

////////////////////////////////////////////////////
// Game classes
////////////////////////////////////////////////////

class PaddleAI extends Paddle {

    static JITTER_THRESHOLD = 10

    #ball;
    #speed;

    constructor(elementId, ball, speed) {
        super(elementId);
        this.#ball = ball;
        this.#speed = speed;
    }

    draw() {
        super.draw();

        var ballPos = this.#ball.yPosition;
        var paddlePos = this.yPosition + Paddle.PADDLE_HEIGHT / 2;
        //disables jitter
        if (Math.abs(paddlePos - ballPos) > PaddleAI.JITTER_THRESHOLD) {
            this.move(paddlePos >= ballPos ? -this.#speed : this.#speed);
        }
    }
}

class PaddlePlayer extends Paddle {

    static #ARROW_UP = 'ArrowUp';
    static #ARROW_DOWN = 'ArrowDown';
    static #MOVE_SPEED = 12;

    movementAllowed = false;

    constructor(elementId) {
        super(elementId);
        //???
        document.addEventListener('keydown', this.getOnButtonPressed.bind(this));
    }

    getOnButtonPressed(e) {
        if (!this.movementAllowed) {
            return;
        }

        if (e.key === PaddlePlayer.#ARROW_UP) {
            this.move(-PaddlePlayer.#MOVE_SPEED);
        } else if (e.key === PaddlePlayer.#ARROW_DOWN) {
            this.move(PaddlePlayer.#MOVE_SPEED);
        }
    }

    onEvent(event) {
        super.onEvent(event);
        if (event === StateMachine.Event.WIN_USER || event === StateMachine.Event.WIN_AI) {
            this.movementAllowed = false;
        } else if (event === StateMachine.Event.START_NEW_GAME) {
            this.movementAllowed = true;
        }
    }
}

class Ball extends GameObject {

    static BALL_SIZE = 10;

    static #START_ANGLE_RANGE = 70;

    static CollisionAngle = {
        CENTER: 0,
        MIDDLE: 30,
        EDGE: 45
    };

    static CollisionSections = [
        { range: [0.0, 0.199], calculate: () => getCosSin(-Ball.CollisionAngle.EDGE) },
        { range: [0.2, 0.399], calculate: () => getCosSin(-Ball.CollisionAngle.MIDDLE) },
        { range: [0.4, 0.599], calculate: () => getCosSin(Ball.CollisionAngle.CENTER) },
        { range: [0.6, 0.799], calculate: () => getCosSin(Ball.CollisionAngle.MIDDLE) },
        { range: [0.8, 1.000], calculate: () => getCosSin(Ball.CollisionAngle.EDGE) },
    ];

    #xDirection;
    #yDirection;

    #xPosition;
    yPosition;

    constructor(elementId, speed) {
        super(elementId);
        this.speed = speed;
    }

    draw() {
        super.draw();
        this.checkForGameOver();

        if (this.state === GameObject.State.GAME_OVER) {
            return;
        }

        this.#xPosition += (this.#xDirection * this.speed);

        if (this.yPosition < 0) {
            this.#yDirection = -this.#yDirection;
            this.yPosition = 0;
        } else if (this.yPosition > PLAY_FIELD_HEIGHT) {
            this.#yDirection = -this.#yDirection;
            this.yPosition = PLAY_FIELD_HEIGHT;
        } else {
            this.yPosition += (this.#yDirection * this.speed);
        }

        this.element.style.top = this.yPosition + 'px';
        this.element.style.left = this.#xPosition + 'px';
        this.element.style.display = 'none';
        this.element.style.display = 'block';
    }

    checkForGameOver() {
        if (this.state === GameObject.State.GAME_OVER) {
            return;
        }

        if (this.#xPosition < 0) {
            StateMachine.postEvent(StateMachine.Event.WIN_AI);
        } else if (this.#xPosition > PLAY_FIELD_WIDTH) {
            StateMachine.postEvent(StateMachine.Event.WIN_USER);
        }
    }

    throw() {
        this.#xPosition = PLAY_FIELD_WIDTH / 2;
        this.yPosition = PLAY_FIELD_HEIGHT / 2;

        var angle = this.generateAngle();
        const [cos, sin] = getCosSin(angle);
        this.#xDirection = cos;
        this.#yDirection = sin;
        if (Math.random() > 0.5) {
            this.#xDirection = -this.#xDirection;
        }

        this.element.style.top = this.yPosition + 'px';
        this.element.style.left = this.#xPosition + 'px';
        this.element.style.display = 'none';
        this.element.style.display = 'block';
    }

    generateAngle() {
        return (Math.random() * Ball.#START_ANGLE_RANGE * 2) - Ball.#START_ANGLE_RANGE;
    }

    getBounds() {
        super.getBounds();
        var top = parseInt(this.element.style.top);
        var left = parseInt(this.element.style.left);

        return new Rectangle(top, left, top + Ball.BALL_SIZE, left + Ball.BALL_SIZE);
    }

    handleCollision(paddle, intersectionPosition) {
        for (var section of Ball.CollisionSections) {
            if (section.range[0] < intersectionPosition && intersectionPosition < section.range[1]) {
                const [cos, sin] = section.calculate();
                this.#xDirection = cos;
                this.#yDirection = sin;
            }
        }

        if (paddle.getId() === 'paddleAI') {
            this.#xDirection = -this.#xDirection;
        }
    }

    onEvent(event) {
        super.onEvent(event);

        if (event === StateMachine.Event.START_NEW_GAME) {
            this.throw();
        }
    }
}

////////////////////////////////////////////////////
// Game loop
////////////////////////////////////////////////////

function onPageLoaded() {
    const ballSpeed = 8;
    const aiSpeed = 2.5;

    var ball = new Ball('ball', ballSpeed);
    var player = new PaddlePlayer('paddlePlayer');
    var ai = new PaddleAI('paddleAI', ball, aiSpeed);
    var scoreBoard = new ScoreBoard('scoreBoard');

    StateMachine.postEvent(StateMachine.Event.START_NEW_GAME);

    function gameLoop() {
        ball.draw();
        player.draw();
        ai.draw();

        isCollision(ball, player);
        isCollision(ball, ai);
    }
    var fps = 60;
    var updateRate = 1000 / fps;
    setInterval(gameLoop, updateRate);
};


document.addEventListener("DOMContentLoaded", onPageLoaded);