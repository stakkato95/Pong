'use strict';

function isCollision(ball, objTwo) {
    var intersectionPosition = ball.getBounds().intersects(objTwo.getBounds());
    if (intersectionPosition) {
        ball.handleCollision(objTwo, intersectionPosition);
    }
}

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

    element;

    constructor(elementId) {
        this.element = document.getElementById(elementId);
    }

    getId() {
        return this.element.id;
    }

    draw() { }

    getBounds() { }
}

class Paddle extends GameObject {

    static #PADDLE_MOVEMENET_RANGE = 400;

    #yPosition;

    constructor(elementId, yPosition) {
        super(elementId);
        this.#yPosition = yPosition;
    }

    move(offset) {
        var underflow = this.isUnderflow(offset);
        var overflow = this.isOverflow(offset);
        if (underflow) {
            this.#yPosition = 0;
        } else if (overflow) {
            this.#yPosition = Paddle.#PADDLE_MOVEMENET_RANGE;
        }

        if (!(underflow || overflow)) {
            this.#yPosition += offset;
        }

        this.redraw();
    }

    isUnderflow(offset) {
        return this.#yPosition + offset <= 0 && offset < 0;
    }

    isOverflow(offset) {
        return this.#yPosition + offset >= Paddle.#PADDLE_MOVEMENET_RANGE && offset > 0;
    }

    redraw() {
        this.element.style.top = this.#yPosition + 'px';
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
            isNaN(left) ? 990 : 0,
            top + 200,
            isNaN(left) ? 1000 : 10);
    }


}

class PaddlePlayer extends Paddle {

    static #ARROW_UP = 'ArrowUp';
    static #ARROW_DOWN = 'ArrowDown';
    static #MOVE_SPEED = 12;

    constructor(yPosition, elementId) {
        super(yPosition, elementId);
        super.move(-1);
        document.addEventListener('keydown', this.getOnButtonPressed(this));
    }

    getOnButtonPressed(_this) {
        return function (e) {
            if (e.key === PaddlePlayer.#ARROW_UP) {
                _this.move(-PaddlePlayer.#MOVE_SPEED);
            } else if (e.key === PaddlePlayer.#ARROW_DOWN) {
                _this.move(PaddlePlayer.#MOVE_SPEED);
            }
        };
    }

    move(offset) {
        super.move(offset);
    }
}

const CollisionType = {
    CENTER: 0,
    MIDDLE: 1,
    EDGE: 2
}

class Ball extends GameObject {

    static PLAY_FIELD_HEIGHT = 600;
    static PLAY_FIELD_WIDTH = 1000;

    static #ANGLE_RANGE_MIN = 35;
    static #ANGLE_RANGE_MAX = 145;

    static CollisionSections = [
        { range: [0.0, 0.199], type: CollisionType.EDGE },
        { range: [0.2, 0.399], type: CollisionType.MIDDLE },
        { range: [0.4, 0.599], type: CollisionType.CENTER },
        { range: [0.6, 0.799], type: CollisionType.MIDDLE },
        { range: [0.8, 1.000], type: CollisionType.EDGE },
    ]

    #xDirection;
    #yDirection;

    #xPosition;
    #yPosition;

    constructor(elementId, speed) {
        super(elementId);
        this.speed = speed;
    }

    draw() {
        super.draw();

        this.#xPosition += (this.#xDirection * this.speed);
        this.#yPosition += (this.#yDirection * this.speed);

        if (this.#yPosition <= 0) {
            this.#yDirection = -this.#yDirection;
            this.#yPosition = 0;
        } else if (this.#yPosition >= Ball.PLAY_FIELD_HEIGHT) {
            this.#yDirection = -this.#yDirection;
            this.#yPosition = Ball.PLAY_FIELD_HEIGHT;
        } else {
            this.#yPosition += (this.#yDirection * this.speed);
        }

        this.#xPosition += (this.#xDirection * this.speed);
        if (this.#xPosition <= 0) {
            // this.#xDirection = -this.#xDirection;
            // this.#xPosition = 0;
        } else if (this.#xPosition >= Ball.PLAY_FIELD_WIDTH) {
            // this.#xDirection = -this.#xDirection;
            // this.#xPosition = Ball.PLAY_FIELD_WIDTH;
        } else {
            // this.#xPosition += (this.#xDirection * this.speed);
        }

        this.element.style.top = this.#yPosition + 'px';
        this.element.style.left = this.#xPosition + 'px';
        this.element.style.display = 'none';
        this.element.style.display = 'block';
    }

    throw() {
        this.#xPosition = Ball.PLAY_FIELD_WIDTH / 2;
        this.#yPosition = Ball.PLAY_FIELD_HEIGHT / 2;

        var angle = this.generateAngle();
        var angleRad = Math.PI * angle / 180;

        this.#yDirection = Math.cos(angleRad);
        this.#xDirection = Math.sin(angleRad);
        if (Math.random() > 0.5) {
            this.#xDirection = -this.#xDirection;
        }

        this.element.style.top = this.#yPosition + 'px';
        this.element.style.left = this.#xPosition + 'px';
        this.element.style.display = 'none';
        this.element.style.display = 'block';
    }

    generateAngle() {
        return (Math.random() * (Ball.#ANGLE_RANGE_MAX - Ball.#ANGLE_RANGE_MIN)) + Ball.#ANGLE_RANGE_MIN;
    }

    getBounds() {
        super.getBounds();
        var top = parseInt(this.element.style.top);
        var left = parseInt(this.element.style.left);

        return new Rectangle(top, left, top + 10, left + 10);
    }

    handleCollision(paddle, intersectionPosition) {
        if (paddle.getId() === 'paddlePlayer') {
            console.log('player handled');
            this.#xDirection = -this.#xDirection;

            for (var section of Ball.CollisionSections) {
                if (section.range[0] < intersectionPosition && intersectionPosition < section.range[1]) {
                    console.log(section.type);
                }
            }
        } else {
            this.#xDirection = -this.#xDirection;
        }
    }
}

function onPageLoaded() {
    var ball = new Ball('ball', 3);
    ball.throw();

    var player = new PaddlePlayer('paddlePlayer', 0);
    var ai = new PaddlePlayer('paddleAI', 0);

    function gameLoop() {
        ball.draw();
        player.draw();

        isCollision(ball, player);
        isCollision(ball, ai);
    }

    var fps = 60;
    var updateRate = 1000 / fps;
    setInterval(gameLoop, updateRate);
};


document.addEventListener("DOMContentLoaded", onPageLoaded);