import React, {useEffect, useState} from 'react';
import {
  Canvas,
  useImage,
  Image,
  Group,
  rotate,
  Text,
  matchFont,
} from '@shopify/react-native-skia';
import {Platform, useWindowDimensions} from 'react-native';
import {
  Easing,
  useSharedValue,
  withTiming,
  withSequence,
  withRepeat,
  useFrameCallback,
  useDerivedValue,
  interpolate,
  Extrapolation,
  useAnimatedReaction,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import {
  GestureHandlerRootView,
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';

const GRAVITY = 1000;
const JUMP_FORCE = -300;
const pipeWidth = 104;
const pipeHeight = 640;

const App = () => {
  const [score, setScore] = useState(0);

  const {width, height} = useWindowDimensions();

  const bg = useImage(require('./assets/sprites/background-day.png'));
  const bird = useImage(require('./assets/sprites/yellowbird-upflap.png'));
  const pipeBottom = useImage(require('./assets/sprites/pipe-green.png'));
  const pipeTop = useImage(require('./assets/sprites/pipe-green-top.png'));
  const base = useImage(require('./assets/sprites/base.png'));

  const x = useSharedValue(width);
  const birdX = width / 4;
  const birdY = useSharedValue(height / 3);
  const birdYVelocity = useSharedValue(0);
  const gameOver = useSharedValue(false);
  const pipeX = useSharedValue(width);
  const pipeOffset = useSharedValue(0);
  const topPipeY = useDerivedValue(() => pipeOffset.value - 320);
  const bottomPipeY = useDerivedValue(() => height - 320 + pipeOffset.value);

  const pipesSpeed = useDerivedValue(() => {
    return interpolate(score, [0, 20], [1, 2]);
  });

  const obstacles = useDerivedValue(() => [
    // Bottom Pipe
    {
      x: pipeX.value,
      y: bottomPipeY.value,
      h: pipeHeight,
      w: pipeWidth,
    },
    // Top Pipe
    {
      x: pipeX.value,
      y: topPipeY.value,
      h: pipeHeight,
      w: pipeWidth,
    },
  ]);

  useEffect(() => {
    moveTheMap();
  }, []);

  const birdTransform = useDerivedValue(() => {
    return [
      {
        rotate: interpolate(
          birdYVelocity.value,
          [-400, 400],
          [-0.5, 0.5],
          Extrapolation.CLAMP,
        ),
      },
    ];
  });

  const birdOrigin = useDerivedValue(() => {
    return {x: width / 4 + 32, y: birdY.value + 24};
  });

  const moveTheMap = () => {
    pipeX.value = withSequence(
      withTiming(width, {duration: 0}),
      withTiming(-150, {
        duration: 3000 / pipesSpeed.value,
        easing: Easing.linear,
      }),

      withTiming(width, {duration: 0}),
    );
  };

  // Scoring System && Changing Pipes position
  useAnimatedReaction(
    () => {
      return pipeX.value;
    },
    (currentValue, prevValue) => {
      const middle = birdX;

      // Change Offset for the position of the next gap
      if (prevValue && currentValue < -100 && prevValue > -100) {
        pipeOffset.value = Math.random() * 400 - 200;
        cancelAnimation(pipeX);
        runOnJS(moveTheMap)();
      }

      if (
        currentValue !== prevValue &&
        prevValue &&
        currentValue <= middle &&
        prevValue > middle
      ) {
        runOnJS(setScore)(score + 1);
      }
    },
  );

  const isPointCollidingWithRect = (point, rect) => {
    'worklet';
    return (
      point.x >= rect.x && // right of the left edge AND
      point.x <= rect.x + rect.w && // left of the right edge AND
      point.y >= rect.y && // below the top AND
      point.y <= rect.y + rect.h // above the bottom
    );
  };

  // Collision Detection
  useAnimatedReaction(
    () => birdY.value,
    (currentValue, prevValue) => {
      const center = {
        x: birdX + 32,
        y: birdY.value + 24,
      };
      // Ground Collision Detection
      if (currentValue > height - 100 || currentValue < 0) {
        gameOver.value = true;
      }

      const isColliding = obstacles.value.some(rect =>
        isPointCollidingWithRect(center, rect),
      );
      if (isColliding) {
        gameOver.value = true;
      }
    },
  );

  // Animation Stop
  useAnimatedReaction(
    () => gameOver.value,
    (currentValue, prevValue) => {
      if (currentValue && !prevValue) {
        cancelAnimation(pipeX);
      }
    },
  );

  useFrameCallback(({timeSincePreviousFrame: dt}) => {
    if (!dt || gameOver.value) {
      return;
    }
    birdY.value = birdY.value + (birdYVelocity.value * dt) / 1000;
    birdYVelocity.value = birdYVelocity.value + (GRAVITY * dt) / 1000;
  });

  const restartGame = () => {
    'worklet';
    birdY.value = height / 3;
    birdYVelocity.value = 0;
    gameOver.value = false;
    pipeX.value = width;
    runOnJS(moveTheMap)();
    runOnJS(setScore)(0);
  };

  const gesture = Gesture.Tap().onStart(() => {
    if (gameOver.value) {
      restartGame();
    } else {
      birdYVelocity.value = JUMP_FORCE;
    }
  });

  const fontFamily = Platform.select({ios: 'Helvetica', default: 'serif'});
  const fontStyle = {
    fontFamily,
    fontSize: 40,
    fontWeight: 'bold',
  };
  const font = matchFont(fontStyle);

  //y : 225 instead of 320
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <GestureDetector gesture={gesture}>
        <Canvas style={{width, height}}>
          {/* BG */}
          <Image image={bg} fit={'cover'} width={width} height={height} />

          {/* PIPES */}
          <Image
            image={pipeTop}
            y={topPipeY}
            x={pipeX}
            width={pipeWidth}
            height={pipeHeight}
          />

          <Image
            image={pipeBottom}
            y={bottomPipeY}
            x={pipeX}
            width={pipeWidth}
            height={pipeHeight}
          />

          {/* BASE */}
          <Image
            image={base}
            width={width}
            height={150}
            y={height - 75}
            x={0}
            fit={'cover'}
          />

          {/* Bird */}
          <Group transform={birdTransform} origin={birdOrigin}>
            <Image image={bird} y={birdY} x={birdX} width={64} height={48} />
          </Group>

          <Text
            text={score.toString()}
            x={width / 2 - 30}
            y={100}
            font={font}
          />
        </Canvas>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};
export default App;
