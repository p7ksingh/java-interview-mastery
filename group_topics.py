#!/usr/bin/env python3
"""
group_topics.py — Group questions into micro-topics within each chapter.
Outputs data/chapters_grouped.json with topic structure.
"""
import json, os, re

DATA = '/Users/PASINGH2501/java-interview-website/data'

def extract_keywords(q):
    """Extract key topic words from a question."""
    q = q.lower()
    # Remove common filler
    for w in ['what is', 'what are', 'how does', 'how do', 'explain', 'describe', 
              'why is', 'why does', 'when should', 'can you', 'given', 'in which',
              'the difference between', 'and', 'the', 'a ', 'an ', 'in java',
              'how to', 'what happens']:
        q = q.replace(w, ' ')
    return q.strip()

def group_questions(answers):
    """Group consecutive related questions into micro-topics."""
    if not answers:
        return []
    
    topics = []
    current_topic = {
        'title': '',
        'questions': [answers[0]]
    }
    
    # Simple but effective: group by detecting topic shifts
    # Questions about the same concept tend to be consecutive
    for i in range(1, len(answers)):
        prev_q = answers[i-1]['question'].lower()
        curr_q = answers[i]['question'].lower()
        
        # Check if this question continues the same topic
        same_topic = False
        
        # Method 1: Shared key terms (check first 3-4 significant words)
        prev_words = set(re.findall(r'\b[a-z]{3,}\b', prev_q))
        curr_words = set(re.findall(r'\b[a-z]{3,}\b', curr_q))
        # Remove very common words
        common_stop = {'what','that','this','with','from','have','does','when','which',
                      'java','how','the','and','for','are','you','can','why','not',
                      'method','class','use','used','between','your','example',
                      'difference','using','each','should','would','being','about',
                      'their','them','into','than','more','over','also','its','one',
                      'two','three','will','has','had','was','were','been','did','done'}
        prev_key = prev_words - common_stop
        curr_key = curr_words - common_stop
        overlap = prev_key & curr_key
        
        if len(overlap) >= 2 and len(overlap) / max(len(curr_key), 1) > 0.25:
            same_topic = True
        
        # Method 2: Same opening pattern (e.g., "What is String..." and "How does String...")
        for term in ['string', 'final', 'static', 'abstract', 'interface', 'enum', 'lambda',
                     'stream', 'optional', 'thread', 'lock', 'synchronized', 'volatile',
                     'hashmap', 'arraylist', 'linkedlist', 'treemap', 'hashset',
                     'exception', 'error', 'try', 'catch', 'throw',
                     'spring', 'bean', 'autowired', 'controller', 'service',
                     'kafka', 'producer', 'consumer', 'topic', 'partition',
                     'docker', 'kubernetes', 'microservice', 'api', 'rest',
                     'jpa', 'hibernate', 'entity', 'repository', 'query',
                     'transaction', 'isolation', 'propagation',
                     'collection', 'list', 'set', 'map', 'queue', 'deque',
                     'immutable', 'equals', 'hashcode', 'comparable', 'comparator',
                     'generics', 'wildcard', 'type erasure',
                     'functional', 'predicate', 'function', 'supplier', 'consumer',
                     'completablefuture', 'executor', 'future', 'callable',
                     'garbage', 'memory', 'heap', 'stack', 'metaspace',
                     'serializ', 'clon', 'reflect',
                     'design pattern', 'singleton', 'factory', 'builder', 'observer',
                     'sql', 'index', 'join', 'normali', 'acid',
                     'oauth', 'jwt', 'security', 'csrf', 'xss',
                     'cache', 'redis', 'circuit', 'resilience',
                     'main', 'vararg', 'autobox', 'primitiv', 'wrapper',
                     'access modif', 'encapsul', 'polymorph', 'inherit', 'overrid', 'overload',
                     'constructor', 'this', 'super',
                     'switch', 'record', 'sealed', 'pattern match',
                     'module', 'classpath', 'package',
                     'annotation', 'marker',
                     'inner class', 'nested', 'anonymous',
                     'iterator', 'iterable', 'for-each', 'foreach',
                     'sort', 'binary search', 'tree', 'graph', 'linked list',
                     'array', 'stack', 'queue', 'heap', 'trie',
                     'dynamic programming', 'greedy', 'backtrack', 'recursion',
                     'sliding window', 'two pointer', 'prefix sum',
                     'behavioral', 'star method', 'strength', 'weakness',
                     'system design', 'load balanc', 'database', 'shard',
                     'cicd', 'pipeline', 'deploy', 'monitor',
                     'git', 'branch', 'merge', 'rebase']:
            if term in prev_q and term in curr_q:
                same_topic = True
                break
        
        if same_topic:
            current_topic['questions'].append(answers[i])
        else:
            # Finish current topic and start new one
            current_topic['title'] = generate_topic_title(current_topic['questions'])
            topics.append(current_topic)
            current_topic = {
                'title': '',
                'questions': [answers[i]]
            }
    
    # Don't forget the last topic
    current_topic['title'] = generate_topic_title(current_topic['questions'])
    topics.append(current_topic)
    
    return topics

def generate_topic_title(questions):
    """Generate a clean topic title from a group of questions."""
    if len(questions) == 1:
        # Single question — use a shortened version of the question
        q = questions[0]['question']
        # Take up to first comma, dash, or parenthesis
        for sep in ['—', ' – ', ' - ', '(', ',']:
            if sep in q:
                q = q[:q.index(sep)]
                break
        return q.strip()[:80]
    
    # Multiple questions — find common theme
    all_words = []
    for q in questions:
        words = re.findall(r'\b[A-Za-z][a-zA-Z]+\b', q['question'])
        all_words.extend(words)
    
    # Count word frequency, prefer capitalized/technical terms
    from collections import Counter
    stop = {'What','How','Why','When','Which','Does','Can','The','And','For','Are',
            'You','Not','Java','With','From','This','That','Have','Between','Your',
            'Each','Should','Would','Using','Into','Over','Also','Its','One','Two',
            'Method','Class','Use','Example','Difference','Being','About','Their',
            'Them','Than','More','Will','Has','Had','Was','Were','Been','Did',
            'Done','Get','Set','Make','Give','Take','Show','Tell','Let',
            'Exactly','Explain','Describe','Specific','Scenario','Cases',
            'Called','Happens','Declared','Applied','Work','Works'}
    filtered = [w for w in all_words if w not in stop and len(w) > 2]
    counts = Counter(filtered)
    
    # Pick top 2-3 most common meaningful words
    top = [w for w, c in counts.most_common(8) if c >= len(questions) * 0.4][:3]
    if top:
        return ' & '.join(top)
    
    # Fallback
    return questions[0]['question'][:60]

def main():
    # Load chapters.json
    with open(os.path.join(DATA, 'chapters.json')) as f:
        chapters_data = json.load(f)
    
    result = {
        'totalAnswers': chapters_data['totalAnswers'],
        'totalChapters': chapters_data['totalChapters'],
        'chapters': []
    }
    
    for ch in chapters_data['chapters']:
        ch_file = os.path.join(DATA, ch['file'])
        with open(ch_file) as f:
            ch_data = json.load(f)
        
        answers = ch_data.get('answers', [])
        topics = group_questions(answers)
        
        ch_entry = {
            'chapter': ch['chapter'],
            'chapterTitle': ch['chapterTitle'],
            'count': ch['count'],
            'file': ch['file'],
            'topics': [{'title': t['title'], 'count': len(t['questions']),
                        'firstId': t['questions'][0]['id'],
                        'ids': [q['id'] for q in t['questions']]}
                       for t in topics]
        }
        result['chapters'].append(ch_entry)
        
        print(f"  Ch{ch['chapter']:>2}: {ch['chapterTitle']:<40} {len(topics):>3} topics from {ch['count']} questions")
    
    # Write grouped chapters
    with open(os.path.join(DATA, 'chapters_grouped.json'), 'w') as f:
        json.dump(result, f, indent=1)
    
    print(f"\nWrote chapters_grouped.json")
    total_topics = sum(len(ch['topics']) for ch in result['chapters'])
    print(f"Total: {total_topics} micro-topics across {len(result['chapters'])} chapters")

if __name__ == '__main__':
    main()
