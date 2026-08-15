import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('posts');
  return rss({
    title: '노아도 알짜정책 포털',
    description: '부모님을 간병하며 직접 찾아 헤맸던 노인 복지 제도를 정리합니다. 기초연금·장기요양·의료비 지원의 자격 요건과 신청 방법을 보호자의 눈높이로 안내합니다.',
    site: context.site || 'https://noado.kr',
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: new Date(post.data.date),
      description: post.data.description,
      link: `/posts/${post.slug}/`,
    })),
  });
}
