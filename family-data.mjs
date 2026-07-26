export const PLAYERS = [
  {slug:'eunjun', name:'은준', role:'나', color:'#ee645a'},
  {slug:'haeun', name:'하은', role:'동생', color:'#56b8e6'},
  {slug:'yunhee', name:'윤희', role:'엄마', color:'#e97995'},
  {slug:'hyunshin', name:'현신', role:'아빠', color:'#1d7180'}
];

export const TMI_QUESTIONS = [
  {id:'fruit', text:'가장 좋아하는 과일은?', placeholder:'예: 복숭아', fallback:['망고','포도','참외','키위','바나나']},
  {id:'food', text:'가장 좋아하는 음식은?', placeholder:'예: 삼겹살', fallback:['초밥','짜장면','삼겹살','떡볶이','치킨']},
  {id:'country', text:'꼭 가보고 싶은 나라는?', placeholder:'예: 스위스', fallback:['캐나다','스위스','이탈리아','태국','뉴질랜드']},
  {id:'dayoff', text:'쉬는 날 가장 하고 싶은 일은?', placeholder:'예: 늦잠 자기', fallback:['늦잠 자기','영화 정주행','산책하기','게임하기','카페 가기']},
  {id:'color', text:'가장 좋아하는 색깔은?', placeholder:'예: 파란색', fallback:['보라색','주황색','노란색','흰색','베이지색']},
  {id:'family-trip', text:'가장 기억에 남는 가족여행 장소는?', placeholder:'예: 제주도', fallback:['제주도','경주','부산','강릉','전주']},
  {id:'screen', text:'가장 좋아하는 영화·드라마·예능은?', placeholder:'예: 무한도전', fallback:['응답하라 1988','무한도전','기생충','범죄도시','슬기로운 의사생활']},
  {id:'hobby', text:'요즘 가장 좋아하는 취미는?', placeholder:'예: 등산', fallback:['독서','등산','요리','게임','운동']},
  {id:'mom-food', text:'어머니가 해준 음식 중 가장 좋아하는 것은?', placeholder:'예: 김치찌개', fallback:['김치찌개','잡채','갈비찜','미역국','된장찌개']},
  {id:'family-wish', text:'가족과 다시 꼭 해보고 싶은 활동은?', placeholder:'예: 다 같이 해외여행', fallback:['해외여행','캠핑','가족사진 촬영','콘서트 관람','제주도 한 달 살기']}
];

export const POINTING_QUESTIONS = [
  {id:'reliable', tone:'positive', text:'우리 가족 중 가장 믿음직한 사람은?'},
  {id:'talk-first', tone:'positive', text:'고민이 생겼을 때 가장 먼저 이야기하고 싶은 사람은?'},
  {id:'kind', tone:'positive', text:'가장 다정한 사람은?'},
  {id:'funny', tone:'positive', text:'가족을 가장 잘 웃게 해주는 사람은?'},
  {id:'phone', tone:'playful', text:'휴대폰 없이 하루를 가장 못 버틸 것 같은 사람은?'},
  {id:'zombie', tone:'playful', text:'좀비가 나타나면 가장 먼저 소리 지를 것 같은 사람은?'},
  {id:'foodie', tone:'positive', text:'숨은 맛집을 가장 잘 찾을 것 같은 사람은?'},
  {id:'calm', tone:'positive', text:'위기 상황에서 가장 침착할 것 같은 사람은?'},
  {id:'admire', tone:'positive', text:'가장 닮고 싶은 장점을 가진 사람은?'},
  {id:'quirky', tone:'playful', text:'가장 4차원인 사람은?'},
  {id:'island', tone:'playful', text:'무인도에서도 가장 잘 살아남을 사람은?'},
  {id:'creator', tone:'playful', text:'유튜버로 데뷔하면 가장 성공할 것 같은 사람은?'},
  {id:'alien', tone:'playful', text:'외계인을 만나도 가장 먼저 친구가 될 것 같은 사람은?'},
  {id:'talent', tone:'playful', text:'갑자기 가족 장기자랑이 시작되면 가장 먼저 무대에 설 사람은?'},
  {id:'time-machine', tone:'playful', text:'타임머신을 타면 가장 엉뚱한 시대로 갈 사람은?'}
];

export const TALK_CARDS = [
  {id:'c01', text:'가족 중 한 사람이 되어 하루를 산다면 누구로 살고 싶어?'},
  {id:'c02', text:'우리 가족과 함께 가보고 싶은 나라는?'},
  {id:'c03', text:'나에게 ‘우리 집’ 하면 떠오르는 이미지는?'},
  {id:'c04', text:'우리 가족을 음식 하나로 표현한다면?'},
  {id:'c05', text:'우리 가족 이야기를 영화로 만든다면 제목은?'},
  {id:'c06', text:'지금까지 가장 웃겼던 가족의 순간은?'},
  {id:'c07', text:'가족사진 중 다시 한번 찍고 싶은 장면은?'},
  {id:'c08', text:'새로운 가족 전통을 하나 만든다면?'},
  {id:'c09', text:'가족여행에서 내가 맡고 싶은 역할은?'},
  {id:'c10', text:'가족과 다 함께 새로 배워보고 싶은 것은?'},
  {id:'c11', text:'가족에게 사랑받고 있다고 느낀 가장 구체적인 순간은?'},
  {id:'c12', text:'최근 가족에게 꼭 칭찬받고 싶었던 일은?'},
  {id:'c13', text:'나에게 ‘가족’이란 한 단어로 무엇일까?'},
  {id:'c14', text:'최근 가족에게 가장 고마웠던 일은?'},
  {id:'c15', text:'가족에게 배운 가장 좋은 습관이나 가치관은?'},
  {id:'c16', text:'가족이 잘 몰랐을 것 같은 내 마음이 있다면?'},
  {id:'c17', text:'요즘 가족에게 가장 듣고 싶은 말은?'},
  {id:'c18', text:'미안했지만 아직 제대로 말하지 못한 일이 있다면?'},
  {id:'c19', text:'5년 뒤 우리 가족은 어떤 모습이면 좋겠어?'},
  {id:'c20', text:'앞으로 가족과 함께 지키고 싶은 약속은?'}
];
