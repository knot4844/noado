import { registerRoot, Composition } from 'remotion';
import { PromoVideo } from './PromoVideo.jsx';

export const RemotionVideo = () => {
  return (
    <>
      <Composition
        id="Promo"
        component={PromoVideo}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          title: "유튜브 자동화 블로그 기사 제목",
          highlights: [
            "실시간 정부 고시 데이터 자동 매핑",
            "인공지능 초안 작성 및 SEO 자가 채점",
            "Remotion 기반 숏츠 영상 자동 생성"
          ]
        }}
      />
    </>
  );
};

registerRoot(RemotionVideo);
