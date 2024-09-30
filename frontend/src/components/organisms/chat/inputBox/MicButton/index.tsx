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

import { attachmentsState } from 'state/chat';

import RecordScreen from './RecordScreen';

// Khai báo window với kiểu any để xử lý TypeScript không nhận diện
const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const SpeechGrammarList =
  (window as any).SpeechGrammarList || (window as any).webkitSpeechGrammarList;

const recognition = new SpeechRecognition();
if (SpeechGrammarList) {
  recognition.grammars = new SpeechGrammarList();
}

recognition.lang = 'vi-VN';
recognition.maxAlternatives = 1;
recognition.continuous = false;
recognition.interimResults = false;

interface Props {
  disabled?: boolean;
  setValue?: Dispatch<SetStateAction<string>>;
}

const MicButton = ({ disabled, setValue }: Props) => {
  const askUser = useRecoilValue(askUserState);
  const { config } = useConfig();
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecordingFinished, setIsRecordingFinished] = useState(false);
  const [volume, setVolume] = useState<number>(0);
  // const silenceTimer = useRef<NodeJS.Timeout | null>(null);
  // const {
  //   startRecording: _startRecording,
  //   error
  // } = useAudio(config?.features.audio);
  const [attachments, setAttachments] = useRecoilState(attachmentsState);

  disabled = disabled || !!askUser;

  const fileReferences = useMemo(() => {
    return attachments
      ?.filter((a) => !!a.serverId)
      .map((a) => ({ id: a.serverId! }));
  }, [attachments]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const cancelling = useRef(false);
  // const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState<NodeJS.Timeout | undefined>(undefined);
  // const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  // const [isRecordingFinished, setIsRecordingFinished] = useState(false);

  const cancelRecording1 = useCallback(() => {
    if (!isRecording || !mediaRecorderRef.current) {
      return;
    }
    cancelling.current = true;
    mediaRecorderRef.current.stop();
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    if (!isRecording || !mediaRecorderRef.current) {
      return;
    }
    mediaRecorderRef.current.stop();
  }, [isRecording]);

  const setEndRecording = useCallback(() => {
    try {
      setIsRecording(false);
      setIsSpeaking(false);
      setIsRecordingFinished(true);
      mediaRecorderRef.current?.stop();
      recognition.stop();
      mediaRecorderRef.current?.stream
        .getTracks()
        .forEach((track) => track.stop());
    } catch (e: any) {
      setError(e);
    }
  }, []);

  const startRecording1 = useCallback(() => {
    if (isRecording || !config) {
      return;
    }
    setIsRecordingFinished(false);
    setError(undefined);
    clearTimeout(timer);
    cancelling.current = false;

    const {
      min_decibels,
      silence_timeout,
      initial_silence_timeout,
      chunk_duration,
      max_duration
    } = config?.features.audio || {};

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        try {
          recognition.start();
          let spokeAtLeastOnce = false;
          let isSpeaking = false;
          let isFirstChunk = true;
          let audioBuffer: Blob | null = null;
          let startTime = Date.now();

          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          mediaRecorder.addEventListener('start', () => {
            setIsRecording(true);
            startTime = Date.now();
          });

          mediaRecorder.addEventListener('dataavailable', async (event) => {
            if (!spokeAtLeastOnce) {
              if (!audioBuffer) {
                audioBuffer = new Blob([event.data], { type: event.data.type });
              } else {
                audioBuffer = new Blob([audioBuffer, event.data], {
                  type: event.data.type
                });
              }
            }
            if (mediaRecorder.state === 'inactive') {
              return;
            }
            const elapsedTime = Date.now() - startTime;
            if (elapsedTime >= max_duration) {
              mediaRecorder.stop();
              stream.getTracks().forEach((track) => track.stop());
              return;
            }

            setIsSpeaking(isSpeaking);
            const [mimeType, _] = mediaRecorder.mimeType.split(';');

            if (audioBuffer) {
              // If there is buffered data and the user has spoken, send the buffered data first
              // await sendAudioChunk(
              //   isFirstChunk,
              //   mimeType,
              //   elapsedTime,
              //   new Blob([audioBuffer, event.data])
              // );
              audioBuffer = null; // Clear the buffer
            } else {
              // await sendAudioChunk(
              //   isFirstChunk,
              //   mimeType,
              //   elapsedTime,
              //   event.data
              // );
            }

            if (isFirstChunk) {
              isFirstChunk = false;
            }
          });

          mediaRecorder.addEventListener('stop', async () => {
            setIsRecording(false);
            setIsSpeaking(false);

            if (spokeAtLeastOnce && !cancelling.current) {
              // setIsRecordingFinished(true);
              // recognition.stop();
              setEndRecording();
              // await endAudioStream(fileReferences);
            }
          });

          const audioContext = new AudioContext();
          const audioStreamSource =
            audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          analyser.minDecibels = min_decibels;

          // Tạo bộ lọc thông thấp
          const lowPassFilter = audioContext.createBiquadFilter();
          lowPassFilter.type = 'lowpass';
          lowPassFilter.frequency.value = 1000; // Điều chỉnh tần số cắt theo nhu cầu

          // Tạo bộ lọc thông cao
          const highPassFilter = audioContext.createBiquadFilter();
          highPassFilter.type = 'highpass';
          highPassFilter.frequency.value = 100; // Điều chỉnh tần số cắt theo nhu cầu

          // Kết nối bộ lọc với nguồn âm thanh và bộ phân tích
          audioStreamSource.connect(highPassFilter);
          highPassFilter.connect(lowPassFilter);
          lowPassFilter.connect(analyser);

          const bufferLength = analyser.frequencyBinCount;

          const domainData = new Uint8Array(bufferLength);

          mediaRecorder.start(chunk_duration);

          const detectSound = () => {
            if (mediaRecorder.state === 'inactive') {
              return;
            }
            analyser.getByteFrequencyData(domainData);
            const soundDetected = domainData.some((value) => value > 0);
            setVolume(
              domainData.reduce((a, b) => a + b, 0) / domainData.length / 255
            );

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

          setTimeout(() => {
            if (!spokeAtLeastOnce) {
              mediaRecorder.stop();
              stream.getTracks().forEach((track) => track.stop());
              setEndRecording();
            } else {
              setTimer(
                setInterval(() => {
                  if (!isSpeaking) {
                    mediaRecorder.stop();
                    stream.getTracks().forEach((track) => track.stop());
                    setEndRecording();
                  } else {
                    isSpeaking = false;
                  }
                }, silence_timeout)
              );
            }
          }, initial_silence_timeout);
        } catch (e: any) {
          setError(e);
        }
      })
      .catch((err) => {
        setError(err.message);
      });
  }, [timer, isRecording, config]);

  const startRecording = useCallback(() => {
    if (disabled) return;

    // navigator.mediaDevices
    //   .getUserMedia({ audio: true })
    //   .then((stream) => {
    //     recognition.start();
    //     setIsRecording(true);

    //     const audioContext = new window.AudioContext();
    //     const audioStreamSource = audioContext.createMediaStreamSource(stream);
    //     const analyser = audioContext.createAnalyser();
    //     audioStreamSource.connect(analyser);
    //     analyser.fftSize = 2048;
    //     const dataArray = new Uint8Array(analyser.frequencyBinCount);

    //     const updateVolume = () => {
    //       analyser.getByteFrequencyData(dataArray);
    //       const volumeLevel = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    //       setVolume(volumeLevel / 255); // Volume từ 0 đến 1

    //       // Kiểm tra âm lượng để dừng khi im lặng
    //       if (volumeLevel / 255 < 0.02) {
    //         if (!silenceTimer.current) {
    //           silenceTimer.current = setTimeout(() => {
    //             recognition.stop();
    //             setIsSpeaking(false);
    //             setIsRecordingFinished(true);
    //             setIsRecording(false);
    //           }, 2000); // Dừng sau 2 giây im lặng
    //         }
    //       } else {
    //         // Nếu có âm thanh, hủy bộ đếm im lặng
    //         clearTimeout(silenceTimer.current as NodeJS.Timeout);
    //         silenceTimer.current = null;
    //       }

    //       requestAnimationFrame(updateVolume);
    //     };

    //     updateVolume();
    //     return () => {
    //       audioContext.close();
    //       clearTimeout(silenceTimer.current as NodeJS.Timeout);
    //     };
    //   })
    //   .catch((err) => {
    //     setValue && setValue(err.message);
    //   });
  }, [fileReferences, disabled]);

  recognition.onresult = function (event: any) {
    console.log(event);
    let interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal || !recognition.interimResults) {
        setValue && setValue(transcript);
        setEndRecording();
        return;
      } else {
        interimTranscript += transcript;
      }
    }
    setValue && setValue(interimTranscript); // Cập nhật kết quả tạm thời
  };

  recognition.onspeechend = function () {
    console.log('Speech has ended');
    // recognition.stop();
  };

  // recognition.onsoundstart = function () {
  //   setIsSpeaking(true);
  // };

  recognition.onsoundend = function () {
    // setIsSpeaking(false);
    console.log('Sound has ended');
  };

  useHotkeys('alt+p', startRecording1);

  useEffect(() => {
    if (!error) return;
    toast.error(error);
  }, [error]);

  useEffect(() => {
    if (isRecordingFinished) setAttachments([]);
  }, [isRecordingFinished]);

  const size = useMediaQuery<Theme>((theme) => theme.breakpoints.down('sm'))
    ? 'small'
    : 'medium';

  if (!config?.features.audio.enabled) return null;

  return (
    <>
      <RecordScreen
        open={isRecording}
        isSpeaking={isSpeaking}
        // volume={volume}
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
            onClick={startRecording1}
          >
            <MicrophoneIcon fontSize={size} />
          </IconButton>
        </span>
      </Tooltip>
    </>
  );
};

export default MicButton;
