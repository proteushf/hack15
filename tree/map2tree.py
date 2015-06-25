from zss import simple_distance, Node


import simplejson
import time
import math
import scipy.cluster.hierarchy as sch
from numpy import *
import sys, getopt
from subprocess import call
import os, shutil


#for edit distance
def construct_node(tree, level, threshold = 1000):
  root=Node(tree['tagName'])
  if 'children' not in tree or level == threshold:
    root.label = tree['tagName']
    return root
  for child in tree['children']:
    child_node = construct_node(child, level+1, threshold)
    root.addkid(child_node)
  return root

def verify_trees(json_root, tree_root):
  if tree_root.label != json_root['tagName']:
    print "not right"
    return False
  for i in range(len(tree_root.children)):
    if not verify_trees(json_root['children'][i], tree_root.children[i]):
      return False
  return True



#lcs
def lcs_dis(a, b):
    lengths = [[0 for j in range(len(b)+1)] for i in range(len(a)+1)]
    # row 0 and column 0 are initialized to 0 already
    for i, x in enumerate(a):
        for j, y in enumerate(b):
            if x == y:
                lengths[i+1][j+1] = lengths[i][j] + 1
            else:
                lengths[i+1][j+1] = \
                    max(lengths[i+1][j], lengths[i][j+1])
    print "distance is:", str(lengths[len(a)][len(b)])
    return lengths[len(a)][len(b)]


def flatten_html(trees_map, threshold = 1000):
  '''
  trees_map: root of an html tree, child nodes are ['url', 'tree', 'css', 'js']
  threshold: depth of recursion
  '''
  result = ['tree']
  flatten_html_by_id_className_tag(trees_map['tree'], result, 0, threshold)
  return result

def flatten_html_help(tree, result, level, threshold = 1000):
  result.append(tree['tagName'])
  if 'children' not in tree or level == threshold:
    return #root.label = tree['signature']
  for child in tree['children']:
    flatten_html_help(child, result, level+1, threshold)

def flatten_html_by_id_className_tag(tree, result, level, threshold = 1000):
  if 'id' in tree and tree['id']:
    node_label = tree['id']
  elif 'classList' in tree and tree['classList']:
    node_label = '_'.join(tree['classList'])
  else:
    node_label = tree['tagName']
  result.append(node_label)
  if 'children' not in tree or level == threshold:
    return #root.label = tree['signature']
  for child in tree['children']:
    flatten_html_by_id_className_tag(child, result, level+1, threshold)

def calc_flattened_xml_distance(flattened_xmls):
  distances = []
  for i in range(len(flattened_xmls)):
    for j in range(i+1,len(flattened_xmls)):
      distances.append(lcs_dis(flattened_xmls[i], flattened_xmls[j]))
  return distances

def calc_xml_distance(xml_maps):
  flattened_xmls = []
  for xml in xml_maps:
    flattened_xmls.append(flatten_html(xml))
  print len(flattened_xmls)
  return calc_flattened_xml_distance(flattened_xmls)


def calc_id_class_set_distance(xml_maps):
  distances = []
  for i in range(len(xml_maps)):
    for j in range(i+1,len(xml_maps)):
      distances.append(calc_set_diff(xml_maps[i]['idClassSet'].keys(), xml_maps[j]['idClassSet'].keys()))
  return distances

def calc_set_diff(a, b):
  a=set(a)
  b=set(b)
  dis = len(a.intersection(b))/(len(a.union(b))+0.000001)
  print "dis:", 1-dis, len(a.intersection(b)), len(a.union(b))
  return 1-dis

#main_area
def pick_subtree(tree, tagName=None, classlist=None, id=None):
  if not tagName and not classlist and not id:
    return None
  #if tree['id'] == id:
  #  print "found"
  if ('tagName' in tree and tree['tagName']==tagName or not tagName) \
    and ('classList' in tree and tree['classList']==classlist or not classlist) \
    and ('id' in tree and tree['id']==id or not id):
    return tree
  elif 'children' in tree:
    for child in tree['children']:
      node = pick_subtree(child, tagName, classlist, id)
      if node:
        return node
  return None


import numpy as np
from scipy.cluster.hierarchy import linkage
import matplotlib.pyplot as plt
#from augmented_dendrogram import augmented_dendrogram
from scipy.cluster.hierarchy import dendrogram
import matplotlib.pyplot as plt

def augmented_dendrogram(*args, **kwargs):
    ddata = dendrogram(*args, **kwargs)
    #print "ddata", ddata
    if not kwargs.get('no_plot', False):
        for i, d in zip(ddata['icoord'], ddata['dcoord']):
            x = 0.5 * sum(i[1:3])
            y = d[1]
            plt.plot(x, y, 'ro')
            plt.annotate("%.3g" % y, (x, y), xytext=(0, -8),
                         textcoords='offset points',
                         va='top', ha='center')
    return ddata


def draw_dendrogram(link_mat, level=6):
  plt.subplots()
  show_leaf_counts = True
  ddata = augmented_dendrogram(link_mat,
                 color_threshold=1,
                 p=level
                 ,
                 truncate_mode='level',
                 show_leaf_counts=show_leaf_counts,
                 )
  plt.title("show_leaf_counts = %s" % show_leaf_counts)
  #plt.show()
  plt.savefig('foo.png')


def main(argv):

  try:
      opts, args = getopt.getopt(argv,"hf:s:l:t:p:e:",["file=", "similarity=","cluster_limit=","cluster_limit_type=", "prune_tag=", "example_pic_count="])
  except getopt.GetoptError:
#      print 'generate_prod_dedup_valid_uids.py -m <merchant_id> -n <num of users having 3 more views> -p <prefix of uids>'
      sys.exit(2)

  file = '/Users/ENG-Mac/Work/hackathon_2015/define_url/tree/data/30_kohls_data.json'
  sim = 'set'
  cluster_limit = 4
  cluster_limit_type = 'maxclust'
  prune_tag = ''
  example_count = 3
  for opt, arg in opts:
    if opt == '-h':
       print 'python map3tree.py -f <parsed xml files> -s <similarity:set or lcs> -l <cluster_limit> -t <cluster_limit_type>'
       sys.exit()
    elif opt in ("-s", "--similarity"):
       sim = arg
    elif opt in ("-l", "--cluster_limit"):
       cluster_limit = float(arg)
    elif opt in ("-t", "--cluster_limit_type"):
       cluster_limit_type = arg
    elif opt in ("-f", "--xml_files"):
       file = arg
    elif opt in ("-p", "--prune_tag"):
       prune_tag = arg
    elif opt in ("-e", "--example_count"):
       example_count = arg


  print file
  print "sim, ", sim
  print "cluster_limit", cluster_limit
  print "cluster_limit_type", cluster_limit_type
  print "example_count", example_count
  f=open(file, 'r')
  str_trees = f.read()
  f.close()
  trees_map = simplejson.loads(str_trees)

  urls = []
  for i in range(len(trees_map)):
    url = trees_map[i]['url']
    print url
    urls.append(url)
    if prune_tag:
      trees_map[i] = pick_subtree(trees_map[i]['tree'], id='main_area')
      if not trees_map[i]:
        print url, "has no matching tag"

  distances = []
  if sim == 'lcs':
    distances = calc_xml_distance(trees_map)
  elif sim == 'set':
    distances = calc_id_class_set_distance(trees_map)
  d = array(distances)
  print d
  L = sch.linkage(d, method='single')
  print L
  if cluster_limit_type == 'distance':
    ind = sch.fcluster(L, cluster_limit*d.max(), 'distance')
  else:
    ind = sch.fcluster(L, int(cluster_limit), 'maxclust')
  print ind

  phantomscript = '/usr/local/bin/webshots'
  cur_dir = os.getcwd()
  group_dir = cur_dir+'/groups/' if cur_dir[len(cur_dir)-1] != '/' else cur_dir+'groups/'
  print "cur_dir", cur_dir
  print "group_dir", group_dir
  if os.path.exists(group_dir):
    shutil.rmtree(group_dir)
  os.mkdir(group_dir)
  groups = {}
  for i in range(len(ind)):
    if ind[i] not in groups:
      groups[ind[i]] = [urls[i]]
      sub_dir = group_dir+'group'+str(ind[i])
      os.mkdir(sub_dir)
      os.chdir(sub_dir)
      call(['webshots', '--width', '800', '--height', '600', urls[i]])
      os.chdir(cur_dir)
    else:
      groups[ind[i]].append(urls[i])
      sub_dir = group_dir+'group'+str(ind[i])
      os.chdir(sub_dir)
      if (len(groups[ind[i]]) < int(example_count)):
        print len(groups[ind[i]])
        call(['webshots', '--width', '800', '--height', '600', urls[i]])
      os.chdir(cur_dir)

  for key in groups:
    sub_dir = group_dir+'group'+str(key)
    os.chdir(sub_dir)
    url_output = open('urls','w')
    url_output.write(str(groups[key]))
    url_output.close()
    print "group", key, groups[key]

  os.chdir(cur_dir)
  draw_dendrogram(L, level=5)


if __name__ == "__main__":
  main(sys.argv[1:])
