/* eslint-disable @typescript-eslint/no-unused-vars */
import { motion } from 'framer-motion';
import { grey } from 'theme/palette';

import { Box } from '@mui/material';
import Backdrop from '@mui/material/Backdrop';

// Import framer-motion
import MicrophoneIcon from 'assets/microphone';

interface Props {
  open?: boolean;
  isSpeaking?: boolean;
  volume?: number;
  onClick?: () => void;
}

export default function RecordScreen({
  open,
  isSpeaking,
  volume = 0,
  onClick
}: Props) {
  // Xác định scale dựa trên volume, với giá trị tối thiểu là 1 và tối đa là 1.5
  const scale = 1 + volume;

  return (
    <Backdrop
      sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
      open={!!open}
    >
      <Box
        height={300}
        width={300}
        position="relative"
        display="flex"
        justifyContent="center"
        alignItems="center"
      >
        {/* SVG circle không cần hiệu ứng */}
        <svg height="160" width="160" xmlns="http://www.w3.org/2000/svg">
          <circle r="80" cx="80" cy="80" fill={grey[50]} />
        </svg>

        {/* SVG với hiệu ứng scale dựa trên framer-motion */}
        <motion.svg
          height="240"
          width="240"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            position: 'absolute',
            zIndex: -1,
            opacity: 0.5
          }}
          // Sử dụng framer-motion để tạo hiệu ứng scale
          animate={{ scale: scale }}
          transition={{
            duration: 0.1, // Thời gian chuyển đổi
            ease: 'easeInOut' // Đường cong chuyển động
          }}
        >
          <circle r="120" cx="120" cy="120" fill={grey[50]} />
        </motion.svg>

        {/* MicrophoneIcon */}
        <MicrophoneIcon
          sx={{
            height: 87,
            width: 87,
            color: 'primary.main',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
          onClick={() => {
            onClick && onClick();
          }}
        />
      </Box>
    </Backdrop>
  );
}
