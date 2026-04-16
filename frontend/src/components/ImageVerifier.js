import exifr from 'exifr';

/**
 * Verify if an image is an original camera photo or potentially fake/downloaded.
 * Checks for:
 * 1. EXIF camera metadata (Make, Model, DateTimeOriginal)
 * 2. GPS data presence
 * 3. Software editing markers
 * 4. File size patterns (screenshots tend to be smaller)
 * 
 * @param {File} file - The image file to verify
 * @returns {Promise<Object>} verification result
 */
export async function verifyImage(file) {
  const result = {
    isOriginal: false,
    confidence: 0, // 0-100
    warnings: [],
    details: {},
    badge: 'unverified', // 'verified', 'suspicious', 'unverified'
  };

  try {
    // 1. Basic file checks
    const ext = file.name.split('.').pop().toLowerCase();
    const validExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
    if (!validExts.includes(ext)) {
      result.warnings.push('Unsupported file format');
      result.badge = 'suspicious';
      return result;
    }

    // 2. Check file size (very small = likely screenshot or icon)
    const fileSizeKB = file.size / 1024;
    if (fileSizeKB < 20) {
      result.warnings.push('File is very small — may not be a real photo');
      result.badge = 'suspicious';
    }

    // 3. Read EXIF data
    let exifData = null;
    try {
      exifData = await exifr.parse(file, {
        // Request all useful tags
        pick: [
          'Make', 'Model', 'DateTimeOriginal', 'CreateDate',
          'GPSLatitude', 'GPSLongitude', 'Software',
          'ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight',
          'Orientation', 'Flash', 'FocalLength', 'ExposureTime',
          'FNumber', 'ISOSpeedRatings', 'ISO',
          'WhiteBalance', 'LensModel', 'ShutterSpeedValue',
        ]
      });
    } catch (e) {
      // EXIF parse failed — might be PNG or edited image
      exifData = null;
    }

    let score = 0;

    if (exifData) {
      result.details = { ...exifData };

      // Camera Make/Model (strong indicator — +35 points)
      if (exifData.Make || exifData.Model) {
        score += 35;
        result.details.camera = `${exifData.Make || ''} ${exifData.Model || ''}`.trim();
      } else {
        result.warnings.push('No camera info found in metadata');
      }

      // DateTimeOriginal (when photo was actually taken — +20 points)
      if (exifData.DateTimeOriginal || exifData.CreateDate) {
        score += 20;
        const photoDate = exifData.DateTimeOriginal || exifData.CreateDate;
        result.details.dateTaken = photoDate;

        // Check if date is reasonable (not in future, not too old)
        const d = new Date(photoDate);
        const now = new Date();
        const yearsDiff = (now - d) / (1000 * 60 * 60 * 24 * 365);
        if (yearsDiff > 10) {
          result.warnings.push('Photo date is more than 10 years old');
          score -= 5;
        }
        if (d > now) {
          result.warnings.push('Photo date is in the future — suspicious');
          score -= 15;
        }
      } else {
        result.warnings.push('No original date/time found');
      }

      // GPS data (+15 points — strong proof of real location)
      if (exifData.GPSLatitude && exifData.GPSLongitude) {
        score += 15;
        result.details.hasGPS = true;
      }

      // Lens/exposure data (+15 points — real camera data)
      if (exifData.FocalLength || exifData.ExposureTime || exifData.FNumber || exifData.LensModel) {
        score += 15;
        result.details.hasLensData = true;
      }

      // Flash info (+5 points)
      if (exifData.Flash !== undefined) {
        score += 5;
      }

      // ISO (+5 points)
      if (exifData.ISOSpeedRatings || exifData.ISO) {
        score += 5;
      }

      // Software editing check (reduces confidence)
      if (exifData.Software) {
        const sw = exifData.Software.toLowerCase();
        const editSoftware = [
          'photoshop', 'gimp', 'lightroom', 'snapseed',
          'canva', 'paint', 'illustrator', 'affinity'
        ];
        const isEdited = editSoftware.some((s) => sw.includes(s));
        if (isEdited) {
          result.warnings.push(`Image was edited with: ${exifData.Software}`);
          score -= 10;
        }
      }
    } else {
      // No EXIF at all
      result.warnings.push('No EXIF metadata found — image may not be an original camera photo');

      // PNG files commonly lack EXIF (screenshots, downloads)
      if (ext === 'png') {
        result.warnings.push('PNG format is commonly used for screenshots and downloads, not camera photos');
        score -= 10;
      }
    }

    // 4. Check image dimensions (use canvas to load and measure)
    try {
      const dimensions = await getImageDimensions(file);
      result.details.width = dimensions.width;
      result.details.height = dimensions.height;

      // Common screenshot resolutions
      const screenshotRes = [
        [1920, 1080], [1366, 768], [1440, 900], [2560, 1440],
        [1536, 864], [1280, 720], [375, 812], [414, 896],
        [390, 844], [428, 926], // iPhone resolutions
      ];

      const isScreenshotRes = screenshotRes.some(
        ([w, h]) =>
          (dimensions.width === w && dimensions.height === h) ||
          (dimensions.width === h && dimensions.height === w)
      );

      if (isScreenshotRes && !exifData?.Make) {
        result.warnings.push('Image has a common screen resolution — may be a screenshot');
        score -= 5;
      }

      // Very large camera photos are typically 3000+ pixels wide
      if (dimensions.width >= 3000 || dimensions.height >= 3000) {
        score += 5; // Likely from a real camera
      }
    } catch (e) {
      // Silent fail on dimension check
    }

    // Clamp score
    result.confidence = Math.max(0, Math.min(100, score));

    // Determine badge
    if (result.confidence >= 50) {
      result.isOriginal = true;
      result.badge = 'verified';
    } else if (result.confidence >= 20) {
      result.isOriginal = false;
      result.badge = 'unverified';
    } else {
      result.isOriginal = false;
      result.badge = 'suspicious';
    }

  } catch (err) {
    console.error('Image verification error:', err);
    result.warnings.push('Verification failed — unable to analyze image');
    result.badge = 'unverified';
  }

  return result;
}

/**
 * Get image dimensions without rendering on screen
 */
function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/**
 * Get the verification badge JSX
 */
export function getVerificationBadge(result) {
  if (!result) return null;

  switch (result.badge) {
    case 'verified':
      return {
        text: `✅ Verified Original (${result.confidence}%)`,
        className: 'img-badge-verified',
        tooltip: result.details.camera
          ? `Camera: ${result.details.camera}`
          : 'EXIF metadata verified',
      };
    case 'suspicious':
      return {
        text: `⚠️ Suspicious (${result.confidence}%)`,
        className: 'img-badge-suspicious',
        tooltip: result.warnings.join('; '),
      };
    default:
      return {
        text: `❓ Unverified (${result.confidence}%)`,
        className: 'img-badge-unverified',
        tooltip: result.warnings.join('; '),
      };
  }
}
