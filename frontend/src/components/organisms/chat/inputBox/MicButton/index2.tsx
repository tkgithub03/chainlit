/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import SpeechRecognition, {
  useSpeechRecognition
} from 'react-speech-recognition';
import { useRecoilState, useRecoilValue } from 'recoil';
import { toast } from 'sonner';

import { IconButton, Theme, Tooltip, useMediaQuery } from '@mui/material';

import {
  IFileRef,
  askUserState,
  useAudio,
  useConfig
} from '@chainlit/react-client';

import { Translator } from 'components/i18n';

import MicrophoneIcon from 'assets/microphone';

import RecordScreen from './RecordScreen';

interface Props {
  disabled?: boolean;
  setValue?: Dispatch<SetStateAction<string>>;
}

const MicButton2 = ({ disabled, setValue }: Props) => {
  const askUser = useRecoilValue(askUserState);
  const { config } = useConfig();
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecordingFinished, setIsRecordingFinished] = useState(false);
  const [volume, setVolume] = useState<number>(0);
  disabled = disabled || !!askUser;
  const {
    transcript,
    listening,
    resetTranscript,
    isMicrophoneAvailable,
    browserSupportsSpeechRecognition,
    finalTranscript,
    interimTranscript
  } = useSpeechRecognition();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const cancelling = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const timeOutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!browserSupportsSpeechRecognition) {
      setError('Your browser does not support speech recognition.');
    }
    return () => {
      SpeechRecognition.stopListening();
    };
  }, [browserSupportsSpeechRecognition]);

  const handleStop = () => {
    setIsRecording(false);
    setIsRecordingFinished(true);
    setIsSpeaking(false);
    console.log('handleStop');
    SpeechRecognition.abortListening();

    SpeechRecognition.stopListening();

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
    }
    if (navigator.userAgent.toLowerCase().indexOf('mobile') > -1) {
      // window.navigator.mediaDevices.getUserMedia().then((stream) => {
      //   stream.getTracks().forEach((track) => track.stop());
      //   stream.getAudioTracks().forEach((track) => track.stop());
      // });
    }

    clearTimeout(timerRef.current);
    clearTimeout(timeOutRef.current);
  };

  useEffect(() => {
    if (setValue) {
      if (finalTranscript) {
        console.log('finalTranscript', finalTranscript);
        setValue(finalTranscript);
        handleStop();
        resetTranscript();
      } else if (transcript && listening) {
        setValue(transcript);
      }
    }
  }, [transcript, finalTranscript, listening]);

  useHotkeys('alt+p', () => {
    if (isRecording) {
      handleStop();
    } else {
      handleStart();
    }
  });

  const handleStart = useCallback(() => {
    // console.log('config',config);
    if (isRecording) {
      return;
    }

    setIsRecordingFinished(false);
    setError(undefined);
    clearTimeout(timerRef.current);
    clearTimeout(timeOutRef.current);
    cancelling.current = false;

    const {
      min_decibels,
      silence_timeout,
      initial_silence_timeout,
      chunk_duration,
      max_duration
    } = config?.features.audio || {
      min_decibels: -55,
      silence_timeout: 1500,
      initial_silence_timeout: 3000,
      chunk_duration: 1000,
      max_duration: 15000
    };

    // console.log('min_decibels', min_decibels);
    if (navigator.userAgent.toLowerCase().indexOf('firefox') > -1) {
      toast.error('Firefox is not supported for recording audio');
      return;
    } else if (navigator.userAgent.toLowerCase().indexOf('mobile') > -1) {
      SpeechRecognition.startListening({
        continuous: true,
        language: 'vi-VN',
        interimResults: true
      });
      setIsRecording(true);
      setIsSpeaking(true);
    } else {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          try {
            // console.log('stream', stream);

            let spokeAtLeastOnce = false;
            let isSpeaking = false;
            let isFirstChunk = true;
            let startTime = Date.now();

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.addEventListener('start', () => {
              SpeechRecognition.startListening({
                continuous: true,
                language: 'vi-VN',
                interimResults: true
              });
              setIsRecording(true);
              startTime = Date.now();
            });

            mediaRecorder.addEventListener('dataavailable', async (event) => {
              if (mediaRecorder.state === 'inactive') {
                return;
              }
              const elapsedTime = Date.now() - startTime;
              if (elapsedTime >= max_duration) {
                handleStop();
                return;
              }
              setIsSpeaking(isSpeaking);
              if (isFirstChunk) {
                isFirstChunk = false;
              }
            });

            mediaRecorder.addEventListener('stop', async () => {
              // setIsRecording(false);
              // setIsSpeaking(false);

              // if (spokeAtLeastOnce && !cancelling.current) {
              //   setIsRecordingFinished(true);
              // }
              handleStop();
            });

            const audioContext = new AudioContext();
            const audioStreamSource =
              audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.minDecibels = min_decibels;
            audioStreamSource.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;

            const domainData = new Uint8Array(bufferLength);

            mediaRecorder.start(chunk_duration);

            const detectSound = () => {
              if (mediaRecorder.state === 'inactive') {
                return;
              }
              analyser.getByteFrequencyData(domainData);
              const soundDetected = domainData.some((value) => value > 0);
              let sum = 0;
              for (let i = 0; i < bufferLength; i++) {
                sum += domainData[i];
              }
              const avg = sum / bufferLength;
              setVolume(avg);

              if (!isSpeaking) {
                isSpeaking = soundDetected;
              }
              if (!spokeAtLeastOnce && soundDetected) {
                setIsSpeaking(isSpeaking);
                spokeAtLeastOnce = true;
              }
              requestAnimationFrame(detectSound);
            };
            detectSound();

            timeOutRef.current = setTimeout(() => {
              if (!spokeAtLeastOnce) {
                mediaRecorder.stop();
                console.log('setTimeout');
                // stream.getTracks().forEach((track) => track.stop());
                handleStop();
              } else {
                timerRef.current = setInterval(() => {
                  if (!isSpeaking) {
                    mediaRecorder.stop();
                    console.log('setInterval');
                    handleStop();
                    // stream.getTracks().forEach((track) => track.stop());
                  } else {
                    isSpeaking = false;
                  }
                }, silence_timeout);
              }
            }, initial_silence_timeout);
          } catch (e: any) {
            setError(e);
          }
        })
        .catch((err) => {
          console.log('err', err);
          setError(err.message);
        });
    }
  }, [isRecording, config, isMicrophoneAvailable, timerRef.current]);

  const size = useMediaQuery<Theme>((theme) => theme.breakpoints.down('sm'))
    ? 'small'
    : 'medium';

  if (!config?.features.audio.enabled && !browserSupportsSpeechRecognition)
    return null;

  return (
    <>
      <RecordScreen
        open={isRecording && isMicrophoneAvailable}
        isSpeaking={isSpeaking}
        volume={volume}
        onClick={() => {
          handleStop();
        }}
      />
      <Tooltip
        title={
          <Translator
            path="components.organisms.chat.inputBox.speechButton.start"
            suffix=" (Alt+P)"
          />
        }
      >
        <span>
          <IconButton
            disabled={disabled || isRecording}
            color="inherit"
            size={size}
            onClick={handleStart}
          >
            <MicrophoneIcon fontSize={size} />
          </IconButton>
        </span>
      </Tooltip>
    </>
  );
};

export default MicButton2;
